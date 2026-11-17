/**
 * Manual adjustments (`Command adjust`, issue #791). **Not an RRG rule**: a digital affordance, like `concede`, so the
 * tests fix the decisions written down in `adjust.ts` rather than cite a page. The rules-adjacent facts that are cited
 * there: placed damage is not dealt (RRG 1.8 "Damage", p. 14), a character at zero hit points and a side scheme with
 * no threat are defeated (RRG 1.8 "Defeat", p. 15), and a main scheme at its target threat is completed (p. 27).
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, test } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import type { Adjustment, Command } from "./commands.js";
import { applyCommand, applyCommands, replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { instanceId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { stubMainScheme, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { ALLY, run, settleUntil } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const MINION = stubMinion({ id: "adjust-minion", atk: 1, sch: 1, hp: 3, keywords: [{ name: "toughness" }] });
const SIDE = stubSideScheme({ id: "adjust-side", startingThreat: 3, boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "adjust-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(10), acceleration: flat(0) }],
});

interface Table {
  readonly state: GameState;
  readonly minion: InstanceId;
  readonly side: InstanceId;
  readonly ally: InstanceId;
}

function table(players: 1 | 2 = 1): Table {
  let state = gameAtFirstTurn({
    players,
    deps: DEFAULT_DEPS,
    cards: [MINION, SIDE, SCHEME],
    mainScheme: SCHEME,
    encounter: [MINION.id, SIDE.id, ...copiesOf("treachery" as CardId, 20)],
  });
  const minion = minionEngagedWith(state, MINION.id);
  state = minion.state;
  const side = encounterCardInVillainArea(state, SIDE.id, 3);
  state = side.state;
  const ally = playerCardIntoPlay(state, ALLY.id as CardId);
  return { state: ally.state, minion: minion.id, side: side.id, ally: ally.id };
}

const adjust = (adjustment: Adjustment, playerId = P1): Command => ({ type: "adjust", playerId, adjustment });

function apply(state: GameState, adjustment: Adjustment) {
  const result = applyCommand(state, adjust(adjustment));
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

function refused(state: GameState, adjustment: Adjustment, code: string, playerId = P1): void {
  const result = applyCommand(state, adjust(adjustment, playerId));
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.code).toBe(code);
}

const types = (events: readonly GameEvent[]) => events.map((event) => event.type);

describe("each adjustment logs manualAdjustment first", () => {
  test("draw: the player draws that many cards", () => {
    const { state } = table();
    const before = mustPlayer(state, P1).hand.length;
    const { state: after, events } = apply(state, { kind: "draw", playerId: P1, count: 2 });
    expect(mustPlayer(after, P1).hand.length).toBe(before + 2);
    expect(events[0]).toEqual({
      type: "manualAdjustment",
      playerId: P1,
      adjustment: { kind: "draw", playerId: P1, count: 2 },
    });
    expect(types(events).filter((type) => type === "cardDrawn")).toHaveLength(2);
  });

  test("discardFromHand: the card goes to its owner's discard pile", () => {
    const { state } = table();
    const card = mustPlayer(state, P1).hand[0]!;
    const { state: after, events } = apply(state, { kind: "discardFromHand", instanceId: card });
    expect(mustPlayer(after, P1).hand).not.toContain(card);
    expect(mustPlayer(after, P1).discard).toContain(card);
    expect(types(events)[0]).toBe("manualAdjustment");
    expect(types(events)).toContain("cardDiscardedFromHand");
  });

  test("discardFromPlay: a card in play is discarded", () => {
    const { state, ally, minion } = table();
    const { state: after } = apply(state, { kind: "discardFromPlay", instanceId: ally });
    expect(mustPlayer(after, P1).playArea).not.toContain(ally);
    expect(mustPlayer(after, P1).discard).toContain(ally);
    const { state: noMinion } = apply(after, { kind: "discardFromPlay", instanceId: minion });
    expect(mustPlayer(noMinion, P1).playArea).not.toContain(minion);
  });

  test("damage: placed, not dealt, so toughness does not stop it; negative removes, never below 0", () => {
    const { state, minion } = table();
    const tough = apply(state, { kind: "status", instanceId: minion, status: "tough", present: true }).state;
    expect(tough.instances[minion]!.statuses.tough).toBe(1);
    const { state: hit, events } = apply(tough, { kind: "damage", instanceId: minion, amount: 2 });
    expect(hit.instances[minion]!.damage).toBe(2);
    expect(hit.instances[minion]!.statuses.tough).toBe(1);
    expect(types(events)).toEqual(["manualAdjustment", "damagePlaced"]);
    const { state: healed, events: healEvents } = apply(hit, { kind: "damage", instanceId: minion, amount: -5 });
    expect(healed.instances[minion]!.damage).toBe(0);
    expect(healEvents[1]).toEqual({ type: "damageHealed", targetInstanceId: minion, amount: 2 });
  });

  test("damage to 0 hit points on a minion defeats it", () => {
    const { state, minion } = table();
    const { state: after, events } = apply(state, { kind: "damage", instanceId: minion, amount: 3 });
    expect(mustPlayer(after, P1).playArea).not.toContain(minion);
    expect(types(events)).toContain("characterDefeated");
  });

  test("threat: placed on and removed from a side scheme; removing the last threat defeats it", () => {
    const { state, side } = table();
    const { state: more } = apply(state, { kind: "threat", instanceId: side, amount: 2 });
    expect(more.instances[side]!.threat).toBe(5);
    const { state: gone, events } = apply(more, { kind: "threat", instanceId: side, amount: -9 });
    expect(gone.villainArea).not.toContain(side);
    expect(types(events)).toEqual(expect.arrayContaining(["manualAdjustment", "threatRemoved", "schemeDefeated"]));
    expect(events.find((event) => event.type === "threatRemoved")).toMatchObject({ amount: 5 });
  });

  test("threat on the main scheme up to its target completes it, here losing the game", () => {
    const { state } = table();
    const scheme = state.mainScheme.instanceId;
    const { state: some } = apply(state, { kind: "threat", instanceId: scheme, amount: 4 });
    expect(some.instances[scheme]!.threat).toBe(state.instances[scheme]!.threat + 4);
    expect(some.outcome).toBeNull();
    const { state: lost } = apply(some, { kind: "threat", instanceId: scheme, amount: 10 });
    expect(lost.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });

  test("counters: placed and removed", () => {
    const { state, ally } = table();
    const { state: on } = apply(state, { kind: "counters", instanceId: ally, counterType: "power", amount: 3 });
    expect(on.instances[ally]!.counters["power"]).toBe(3);
    const { state: off, events } = apply(on, { kind: "counters", instanceId: ally, counterType: "power", amount: -1 });
    expect(off.instances[ally]!.counters["power"]).toBe(2);
    expect(types(events)).toEqual(["manualAdjustment", "counterRemoved"]);
  });

  test("status: given and removed one card at a time, within the character's capacity", () => {
    const { state, ally } = table();
    const { state: stunned } = apply(state, { kind: "status", instanceId: ally, status: "stunned", present: true });
    expect(stunned.instances[ally]!.statuses.stunned).toBe(1);
    refused(stunned, { kind: "status", instanceId: ally, status: "stunned", present: true }, "no_valid_target");
    const { state: clear } = apply(stunned, { kind: "status", instanceId: ally, status: "stunned", present: false });
    expect(clear.instances[ally]!.statuses.stunned).toBe(0);
    refused(clear, { kind: "status", instanceId: ally, status: "stunned", present: false }, "no_valid_target");
  });

  test("exhaust and ready", () => {
    const { state, ally } = table();
    const { state: tired, events } = apply(state, { kind: "exhaust", instanceId: ally });
    expect(tired.instances[ally]!.exhausted).toBe(true);
    expect(types(events)).toEqual(["manualAdjustment", "cardExhausted"]);
    refused(tired, { kind: "exhaust", instanceId: ally }, "already_exhausted");
    const { state: fresh } = apply(tired, { kind: "ready", instanceId: ally });
    expect(fresh.instances[ally]!.exhausted).toBe(false);
    refused(fresh, { kind: "ready", instanceId: ally }, "no_valid_target");
  });

  test("changeForm: ignores the once-per-round limit and does not use it up", () => {
    const { state } = table();
    const start = mustPlayer(state, P1).identity.form;
    const once = apply(state, { kind: "changeForm", playerId: P1 }).state;
    expect(mustPlayer(once, P1).identity.form).not.toBe(start);
    const twice = apply(once, { kind: "changeForm", playerId: P1 }).state;
    expect(mustPlayer(twice, P1).identity.form).toBe(start);
    expect(mustPlayer(twice, P1).identity.changedFormThisRound).toBe(false);
    // The player's own change of form is still there to use.
    expect(applyCommand(twice, { type: "changeForm", playerId: P1 }).ok).toBe(true);
  });
});

describe("refusals change nothing", () => {
  test("unknown player, unknown card, wrong zone, a 0 amount", () => {
    const { state, ally, minion } = table();
    const deckCard = mustPlayer(state, P1).deck[0]!;
    refused(state, { kind: "draw", playerId: P1, count: 1 }, "unknown_player", P2);
    refused(state, { kind: "draw", playerId: P2, count: 1 }, "unknown_player");
    refused(state, { kind: "draw", playerId: P1, count: 0 }, "invalid_choice");
    refused(state, { kind: "damage", instanceId: instanceId("nope"), amount: 1 }, "unknown_instance");
    refused(state, { kind: "discardFromHand", instanceId: deckCard }, "card_not_in_zone");
    refused(state, { kind: "discardFromPlay", instanceId: deckCard }, "card_not_in_zone");
    refused(state, { kind: "damage", instanceId: ally, amount: 0 }, "invalid_choice");
    refused(state, { kind: "damage", instanceId: ally, amount: 1.5 }, "invalid_choice");
    refused(state, { kind: "damage", instanceId: ally, amount: -1 }, "no_valid_target");
    refused(state, { kind: "threat", instanceId: minion, amount: 1 }, "no_valid_target");
    refused(state, { kind: "counters", instanceId: ally, counterType: "power", amount: -1 }, "no_valid_target");
  });

  test("an identity, a villain and a main scheme cannot be discarded from play", () => {
    const { state } = table();
    refused(
      state,
      { kind: "discardFromPlay", instanceId: mustPlayer(state, P1).identity.instanceId },
      "no_valid_target",
    );
    refused(state, { kind: "discardFromPlay", instanceId: state.activeVillainId! }, "no_valid_target");
    refused(state, { kind: "discardFromPlay", instanceId: state.mainScheme.instanceId }, "no_valid_target");
  });

  test("an eliminated seat cannot adjust or be drawn for", () => {
    const { state } = table(2);
    const out = {
      ...state,
      players: state.players.map((player) => (player.playerId === P2 ? { ...player, eliminated: true } : player)),
    };
    refused(out, { kind: "draw", playerId: P1, count: 1 }, "not_active_player", P2);
    refused(out, { kind: "draw", playerId: P2, count: 1 }, "not_active_player");
  });

  test("refused while a choice is open", () => {
    const { state } = table();
    const atDefense = settleUntil(
      run(
        state,
        ...(mustPlayer(state, P1).identity.form === "hero" ? [] : [{ type: "changeForm", playerId: P1 } as Command]),
        {
          type: "endTurn",
          playerId: P1,
        },
      ),
      "declareDefender",
    );
    expect(atDefense.pendingChoice).not.toBeNull();
    refused(atDefense, { kind: "draw", playerId: P1, count: 1 }, "choice_pending");
  });
});

describe("replay", () => {
  const script = (t: Table): readonly Command[] => [
    adjust({ kind: "draw", playerId: P1, count: 1 }),
    adjust({ kind: "damage", instanceId: t.minion, amount: 3 }),
    adjust({ kind: "threat", instanceId: t.side, amount: -3 }),
    adjust({ kind: "status", instanceId: t.ally, status: "confused", present: true }),
    adjust({ kind: "exhaust", instanceId: t.ally }),
    adjust({ kind: "changeForm", playerId: P1 }),
  ];

  test("a list of adjustments applies to the same state and events every time", () => {
    const t = table();
    const first = applyCommands(t.state, script(t));
    const second = applyCommands(t.state, script(t));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
    expect(types(first.events).filter((type) => type === "manualAdjustment")).toHaveLength(6);
  });

  test("a session's log replays its adjustments", () => {
    const t = table();
    let session = startSession(t.state);
    for (const command of script(t)) {
      const result = sessionApply(session, command);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    const replayed = replay(session.log);
    expect(replayed.ok).toBe(true);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
