/**
 * Log lines that used to be missing or misleading: a unique card refused by a card of the same title, consequential
 * damage, a card flipped by a card, counters, a swap, a ready after a form change, and a Special that blanked a minion.
 */
import { activeVillain, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS, CARDS_BY_ID } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine, appendEvents, emptyLog } from "./log-lines.js";
import { cardName } from "./names.js";

let state: GameState;
let me: PlayerId;
let villain: InstanceId;
let handCard: InstanceId;
let otherCard: InstanceId;

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
  villain = activeVillain(state).instanceId;
  handCard = state.players[0]!.hand[0]!;
  otherCard = state.players[0]!.hand[1]!;
}, 30_000);

const as = (id: InstanceId, cardId: string, flipped = false): GameState => {
  const card = CARDS_BY_ID.get(cardId)!;
  return {
    ...state,
    cardPool: { ...state.cardPool, [cardId]: card },
    instances: { ...state.instances, [id]: { ...state.instances[id]!, cardId: card.id, flipped } },
  } as GameState;
};

const lines = (events: readonly GameEvent[], at: GameState = state): readonly string[] =>
  appendEvents(emptyLog(), events, at, me, POOL_DEPS).lines.map((line) => line.text);

describe("a refused unique card", () => {
  test("names each card by its type and says why, even when both share a title", () => {
    const sameTitle = as(handCard, state.instances[villain]!.cardId as string);
    const text = logLine(
      {
        type: "uniqueEntryBlocked",
        instanceId: handCard,
        cardId: sameTitle.instances[handCard]!.cardId,
        matchedInstanceId: villain,
        disposition: "discarded",
      },
      sameTitle,
      me,
      POOL_DEPS,
    )!.text;
    expect(text).toMatch(/^The .+ villain is discarded: unique, and another is already in play\.$/);
  });

  test("different types are each named", () => {
    const text = logLine(
      {
        type: "uniqueEntryBlocked",
        instanceId: handCard,
        cardId: state.instances[handCard]!.cardId,
        matchedInstanceId: villain,
        disposition: "discarded",
      },
      state,
      me,
      POOL_DEPS,
    )!.text;
    expect(text).toContain("is discarded: unique, and the villain Rhino is in play.");
  });

  test("a player card with no effect says so", () => {
    const text = logLine(
      {
        type: "uniqueEntryBlocked",
        instanceId: handCard,
        cardId: state.instances[handCard]!.cardId,
        matchedInstanceId: villain,
        disposition: "noEffect",
      },
      state,
      me,
      POOL_DEPS,
    )!.text;
    expect(text).toContain("has no effect: unique, and the villain Rhino is in play.");
  });
});

describe("consequential damage", () => {
  const ally = (): GameState => state; // the line reads the event stream, not the card type
  test("after the ally's own attack it is consequential damage for attacking", () => {
    const events: GameEvent[] = [
      { type: "damageDealt", targetInstanceId: villain, amount: 1, sourceInstanceId: handCard },
      { type: "damageDealt", targetInstanceId: handCard, amount: 1, sourceInstanceId: handCard },
    ];
    const out = lines(events, ally());
    expect(out[1]).toMatch(/took 1 consequential damage for attacking\.$/);
    expect(out[1]).not.toContain("from");
  });

  test("after its thwart it is for thwarting", () => {
    const events: GameEvent[] = [
      { type: "threatRemoved", schemeInstanceId: state.mainScheme.instanceId, amount: 1, sourceInstanceId: handCard },
      { type: "damageDealt", targetInstanceId: handCard, amount: 2, sourceInstanceId: handCard },
    ];
    expect(lines(events, ally())[1]).toMatch(/took 2 consequential damage for thwarting\.$/);
  });

  test("self-damage with no attack or thwart before it reads as dealt by itself", () => {
    const events: GameEvent[] = [
      { type: "damageDealt", targetInstanceId: handCard, amount: 2, sourceInstanceId: handCard },
    ];
    expect(lines(events)[0]).toMatch(/took 2 damage from itself\.$/);
  });
});

describe("a card flipped by a card, and its counters", () => {
  test("Phoenix Force flipped to Unleashed names the side", () => {
    expect(lines([{ type: "cardFlipped", instanceId: handCard, flipped: true }], as(handCard, "34002a", true))[0]).toBe(
      "Phoenix Force flipped to UNLEASHED.",
    );
    expect(lines([{ type: "cardFlipped", instanceId: handCard, flipped: false }], as(handCard, "34002a"))[0]).toBe(
      "Phoenix Force flipped to RESTRAINED.",
    );
  });

  test("counter changes read as gets / loses", () => {
    const at = as(handCard, "34002a");
    expect(lines([{ type: "counterAdded", instanceId: handCard, counterType: "power", amount: 1 }], at)[0]).toBe(
      "Phoenix Force gets 1 power counter.",
    );
    expect(lines([{ type: "counterRemoved", instanceId: handCard, counterType: "power", amount: 3 }], at)[0]).toBe(
      "Phoenix Force loses 3 power counters.",
    );
  });

  test("a ready right after a flip or form change is told; a plain ready stays quiet", () => {
    const flipThenReady: GameEvent[] = [
      { type: "cardFlipped", instanceId: handCard, flipped: true },
      { type: "cardReadied", instanceId: otherCard },
    ];
    expect(lines(flipThenReady, as(handCard, "34002a", true))).toHaveLength(2);
    expect(lines([{ type: "cardReadied", instanceId: otherCard }])).toHaveLength(0);
  });

  test("a card ability's ready is told, past the frames between them (Indomitable: discard it → ready your hero)", () => {
    const ability = [
      { type: "abilityResolved", instanceId: handCard, abilityId: "01082.indomitable-response" },
      { type: "framePushed" },
      { type: "cardReadied", instanceId: otherCard },
    ] as unknown as GameEvent[];
    expect(lines(ability).at(-1)).toMatch(/readies\.$/);
  });
});

describe("a card an encounter card exhausts (issue 136)", () => {
  test("is told with its source; the player's own exhaust stays quiet", () => {
    const hero = state.players[0]!.identity.instanceId;
    const sonicBoom = as(otherCard, "01123");
    const encounter = {
      ...sonicBoom,
      instances: { ...sonicBoom.instances, [otherCard]: { ...sonicBoom.instances[otherCard]!, ownerId: null } },
    } as GameState;
    expect(lines([{ type: "cardExhausted", instanceId: hero, sourceInstanceId: otherCard }], encounter)).toEqual([
      `Sonic Boom exhausts ${cardName(encounter, hero)}.`,
    ]);
    // A cost, attack, thwart or defense carries no source; a player's own card exhausting something is their play.
    expect(lines([{ type: "cardExhausted", instanceId: hero }], encounter)).toHaveLength(0);
    expect(lines([{ type: "cardExhausted", instanceId: hero, sourceInstanceId: handCard }], encounter)).toHaveLength(0);
  });
});

describe("a swap", () => {
  test("names what left play and what entered", () => {
    const text = lines([
      {
        type: "cardsSwapped",
        how: "leftAndEntered",
        outgoing: handCard,
        incoming: otherCard,
        cardIds: ["a", "b"] as never,
      },
    ])[0]!;
    expect(text).toMatch(/ leaves play; .+ enters play\.$/);
  });

  test("a refused swap says why", () => {
    expect(lines([{ type: "swapRefused", reason: "unique", instanceIds: [] }])[0]).toContain(
      "unique and already in play",
    );
  });
});

describe("a Special that blanks a text box", () => {
  test("names the minion that was blanked", () => {
    const events: GameEvent[] = [
      {
        type: "lastingEffectAdded",
        effect: { id: "x", kind: "blankTextBox", targets: [villain], duration: { kind: "endOfRound" } } as never,
      },
      { type: "abilityResolved", instanceId: handCard, abilityId: "36005.blizzard-special" as never, controllerId: me },
    ];
    const at = as(handCard, "36005");
    const out = lines(events, at);
    expect(out.at(-1)).toBe("Blizzard — Special: Rhino has a blank text box.");
  });
});

describe("a player's attack that ends early", () => {
  test("names the card that left play: the attacker, or the target (RRG v1.8 p.13)", () => {
    const ended = (reason: "attackerLeftPlay" | "targetLeftPlay") =>
      logLine(
        { type: "playerAttackEnded", attackerInstanceId: handCard, targetInstanceId: villain, reason },
        state,
        me,
        POOL_DEPS,
      )!.text;
    const target = cardName(state, villain);
    expect(ended("attackerLeftPlay").endsWith(`${target} left play first.`)).toBe(false);
    expect(ended("targetLeftPlay").endsWith(`— ${target} left play first.`)).toBe(true);
  });
});
