/** Wave 9 (Agents of S.H.I.E.L.D.) log lines: surge deals, max per player, extra power costs, hidden piles, the mole. */
import { activeVillain, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;
let a: InstanceId;
let b: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
  a = activeVillain(state).instanceId;
  b = state.players[0]!.hand[0]!;
});

const text = (event: GameEvent): string | undefined => logLine(event, state, me, POOL_DEPS)?.text;
const cardId = (id: InstanceId) => state.instances[id]!.cardId;

describe("wave 9 log lines", () => {
  test("a surge deals a card", () => {
    expect(text({ type: "surgeTriggered", instanceId: a, playerId: me })).toBe(
      "Surge — You are dealt another encounter card.",
    );
  });

  test("max per player has its own line", () => {
    expect(
      text({ type: "putIntoPlayRefused", instanceId: b, playerId: me, reason: "maxPerPlayer" } as GameEvent),
    ).toMatch(/stays where it was: no one can control another copy/);
  });

  test("extra power costs", () => {
    const base = { playerId: me, characterInstanceId: b };
    expect(text({ type: "additionalPowerCostPaid", ...base, power: "thwart", sourceInstanceIds: [a] })).toMatch(
      /^You paid an extra cost to thwart with /,
    );
    expect(text({ type: "additionalPowerCostAsked", ...base, power: "defend" })).toMatch(
      /needs an extra cost to defend/,
    );
    expect(text({ type: "additionalPowerCostNotPaid", ...base, power: "defend" })).toMatch(/does not defend/);
  });

  test("hidden piles name sizes while dealt, cards only once open", () => {
    const dealt = text({
      type: "hiddenPilesDealt",
      from: "set",
      piles: [
        { pile: "aim", size: 3 },
        { pile: "shield", size: 5 },
      ],
      kept: false,
    });
    expect(dealt).toBe("Hidden piles dealt: A.I.M. 3, S.H.I.E.L.D. 5.");
    expect(text({ type: "hiddenPilesDealt", from: "set", piles: [], kept: true })).toBeUndefined();
    expect(text({ type: "hiddenPileCardsGained", pile: "aim", cardIds: [], requested: 1, remaining: 0 })).toBe(
      "The A.I.M. pile is empty.",
    );
    expect(text({ type: "hiddenPileRevealed", pile: "shield", cardIds: [cardId(a)] })).toMatch(
      /^The S.H.I.E.L.D. pile is turned faceup: /,
    );
  });

  test("the accusation and the mole", () => {
    const row = { means: cardId(b), motive: cardId(b), opportunity: cardId(b), boardMember: cardId(a) };
    expect(text({ type: "accusationMade", playerId: me, accused: row })).toMatch(/^You accuse /);
    expect(text({ type: "moleIdentified", pile: "aim", accused: row, mole: row, wrong: [] })).toMatch(
      /^The mole is .+\. The accusation was correct\.$/,
    );
    expect(text({ type: "moleIdentified", pile: "aim", accused: row, mole: row, wrong: ["means", "motive"] })).toMatch(
      /2 of 4 guesses were wrong\.$/,
    );
    expect(text({ type: "moleIdentified", pile: "aim", accused: null, mole: null, wrong: [] })).toBe(
      "The A.I.M. cards match no board member.",
    );
  });

  test("a flip that kept counters says so; counters move and change type", () => {
    expect(
      text({
        type: "cardFlippedToOtherFace",
        instanceId: a,
        from: cardId(a),
        to: cardId(a),
        typeChanged: true,
        keptCounters: { threat: 2 },
      }),
    ).toMatch(/turns over and keeps 2 threat counters\.$/);
    expect(
      text({ type: "countersMoved", from: a, to: b, counterType: "all_purpose", amount: 1, toCounterType: "threat" }),
    ).toMatch(/^1 all purpose counter moves from .+ and becomes threat\.$/);
  });

  test("a card that turns over later in the command is named by the face it had (issue #700)", () => {
    // Secure the Landing Pad's last threat comes off, it is defeated, and its When Defeated turns it over to Cosmo, all
    // in one command: the state after it holds the new face, but the threat and the defeat were the side scheme's.
    // Stand-ins: card `b`'s face plays the side scheme, card `a`'s (now on the instance) the ally it turns into.
    const flip: GameEvent = {
      type: "cardFlippedToOtherFace",
      instanceId: a,
      from: cardId(b),
      to: cardId(a),
      typeChanged: true,
    };
    const events: GameEvent[] = [
      { type: "threatRemoved", schemeInstanceId: a, amount: 1, sourceInstanceId: null },
      { type: "schemeDefeated", instanceId: a, cardId: cardId(b) },
      flip,
    ];
    const was = state.cardPool[cardId(b)]!.name;
    const now = state.cardPool[cardId(a)]!.name;
    const at = (i: number) => logLine(events[i]!, state, me, POOL_DEPS, false, undefined, { events, at: i })?.text;
    expect(at(0)).toBe(`1 threat removed from ${was}.`);
    expect(at(1)).toBe(`${was} was cleared.`);
    expect(at(2)).toBe(`${was} turns over to ${now}.`);
  });

  test("the encounter deck's shown top card, a held minion, a rearrangement", () => {
    expect(text({ type: "encounterTopShown", deckId: "d" as never, instanceId: a, cardId: cardId(a) })).toMatch(
      /^The encounter deck's top card is faceup: /,
    );
    expect(text({ type: "encounterTopHidden", deckId: "d" as never })).toBe(
      "The encounter deck's top card is facedown again.",
    );
    expect(text({ type: "minionHeld", instanceId: a, hostInstanceId: b, engagedBefore: null })).toMatch(/ is held by /);
    expect(text({ type: "cardsRearranged", playerId: me, positions: [], instanceIds: [a, b], moved: 0 })).toBe(
      "You put the cards back in the same order.",
    );
  });

  test("a retargeted attack has its own line, not the guard wording", () => {
    const line = text({
      type: "attackTargetSkipped",
      attackerInstanceId: b,
      targetInstanceId: a,
      sourceInstanceId: null,
      reason: "attackRetargeted",
    } as GameEvent);
    expect(line).toMatch(/attack moved to another target, so .+ takes no damage\.$/);
    expect(line).not.toContain("can't attack");
  });

  test("a seat that sits a scenario out reads as one neutral line, not a loss", () => {
    const events: GameEvent[] = [
      { type: "playerEliminated", playerId: me },
      { type: "playerSatOut", playerId: me, startingPlayerCount: 1 },
    ];
    const burst = (at: number) => ({ events, at });
    expect(logLine(events[0]!, state, null, POOL_DEPS, false, undefined, burst(0))).toBeNull();
    const line = logLine(events[1]!, state, null, POOL_DEPS, false, undefined, burst(1));
    expect(line?.text).toMatch(/ sits this scenario out\. Set for 1 player\.$/);
    expect(line?.voice).toBe("scenario");
    expect(logLine(events[1]!, state, me, POOL_DEPS)?.text).toBe("You sit this scenario out. Set for 1 player.");
    // A plain elimination keeps the loss voice.
    const plain = logLine(events[0]!, state, null, POOL_DEPS, false, undefined, { events: [events[0]!], at: 0 });
    expect(plain?.voice).toBe("loss");
    expect(
      logLine({ type: "playerSatOut", playerId: me, startingPlayerCount: 2 }, state, null, POOL_DEPS)?.text,
    ).toMatch(/Set for 2 players\.$/);
  });
});
