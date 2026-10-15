/**
 * Log lines touched by wave 10 (docs/phase7-wave10.md §3.2): a main scheme advance names the stage's printed number,
 * not its index in the card. The two differ on a card holding several stages of one number (Civil War's `registration`
 * and `resistance`), where a game plays two chosen stages out of eight.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
}, 30_000);

const text = (event: GameEvent, game: GameState = state): string | undefined =>
  logLine(event, game, me, POOL_DEPS)?.text;

describe("mainSchemeAdvanced", () => {
  test("a card whose stages are numbered in order reads as before", () => {
    expect(text({ type: "mainSchemeAdvanced", stageIndex: 1 })).toBe("The main scheme advances to stage 2.");
  });

  test("the printed stage number is named when it is not the index plus one", () => {
    const card = state.cardPool[state.mainScheme.cardId]!;
    if (card.type !== "main_scheme") throw new Error("not a main scheme");
    const [first, second] = card.stages;
    // Eight stages numbered as the Civil War cards are: index 6 is a stage 2.
    const numbers = [1, 2, 1, 2, 1, 1, 2, 2];
    const stages = numbers.map((stageNumber, index) => ({ ...(index === 0 ? first : second!), stageNumber }));
    const game: GameState = {
      ...state,
      cardPool: { ...state.cardPool, [card.id]: { ...card, stages: [stages[0]!, ...stages.slice(1)] } },
    };
    expect(text({ type: "mainSchemeAdvanced", stageIndex: 6 }, game)).toBe("The main scheme advances to stage 2.");
  });
});

describe("choiceResolved on the enemy team's behalf (MC56 p. 6)", () => {
  const behalf = { kind: "enemyTeam", teamId: "team-1", facingPlayerId: null } as never;
  const requested = (): GameEvent =>
    ({
      type: "choiceRequested",
      choice: {
        choiceId: "c1",
        playerId: me,
        prompt: { kind: "chooseTarget" },
        minSelections: 1,
        maxSelections: 1,
        options: [
          { optionId: "a", label: "Stark Tower", ref: { kind: "none" } },
          { optionId: "b", label: "Avengers Mansion", ref: { kind: "none" } },
        ],
        frameId: null,
        ordered: false,
        soleDecider: false,
        authority: "enemyTeam",
        onBehalfOf: behalf,
      },
    }) as unknown as GameEvent;
  const resolved = (ids: string[], playerId: PlayerId = me): GameEvent =>
    ({
      type: "choiceResolved",
      choiceId: "c1",
      playerId,
      selectedOptionIds: ids,
      onBehalfOf: behalf,
    }) as unknown as GameEvent;
  const line = (event: GameEvent, events: GameEvent[]) =>
    logLine(event, state, me, POOL_DEPS, false, undefined, { events, at: events.indexOf(event) })?.text;

  test("names who decided and what the enemy team chose", () => {
    const done = resolved(["a"]);
    expect(line(done, [requested(), done])).toBe("The enemy team (decided by you) chose Stark Tower.");
    const other = resolved(["a", "b"], "player-ana" as PlayerId);
    expect(line(other, [requested(), other])).toBe(
      "The enemy team (decided by player-ana) chose Stark Tower and Avengers Mansion.",
    );
  });

  test("without the request in view, only who decided", () => {
    expect(text(resolved(["a"]))).toBe("The enemy team's choice was decided by you.");
  });

  test("an ordinary choice resolving is not logged", () => {
    expect(
      text({ type: "choiceResolved", choiceId: "c1", playerId: me, selectedOptionIds: ["a"] } as unknown as GameEvent),
    ).toBeUndefined();
  });
});

describe("Civil War events (docs/phase7-wave10.md sections 3.2, 3.10, 3.15, 3.19)", () => {
  let a: string;
  let b: string;
  let c: string;
  beforeAll(() => {
    [a, b] = Object.keys(state.instances) as [string, string];
    c = state.players[0]!.identity.instanceId;
  });
  const named = (id: string): string => state.cardPool[state.instances[id]!.cardId]!.name;
  const burst = (events: GameEvent[], at: number) => ({ events, at });

  test("the stages chosen for this game are named in order", () => {
    const card = state.cardPool[state.mainScheme.cardId];
    if (card?.type !== "main_scheme") throw new Error("not a main scheme");
    const event = {
      type: "mainSchemeStagesChosen",
      schemeInstanceId: state.mainScheme.instanceId,
      order: [1],
    } as GameEvent;
    expect(text(event)).toBe("Main scheme stages for this game: Secret Rendezvous.");
  });

  test("a permanent attachment moving to a new holder, and one attached from a play area", () => {
    const from = {
      type: "permanentAttachmentRehosted",
      instanceId: a,
      fromInstanceId: b,
      hostInstanceId: c,
    } as GameEvent;
    expect(text(from)).toBe(`${named(a)} moves from ${named(b)} to Peter Parker.`);
    const loose = {
      type: "permanentAttachmentRehosted",
      instanceId: a,
      fromInstanceId: null,
      hostInstanceId: c,
    } as GameEvent;
    expect(text(loose)).toBe(`${named(a)} is attached to Peter Parker.`);
  });

  test("a defeated minion given to the leader as a facedown boost card is named; one dealt from a deck is not", () => {
    const defeated = { type: "characterDefeated", instanceId: a, cardId: state.instances[a]!.cardId } as GameEvent;
    const dealt = { type: "boostCardDealt", enemyInstanceId: b, instanceId: a, outsideActivation: true } as GameEvent;
    expect(logLine(dealt, state, me, POOL_DEPS, false, undefined, burst([defeated, dealt], 1))?.text).toBe(
      `${named(a)} was given to ${named(b)} as a facedown boost card.`,
    );
    expect(logLine(dealt, state, me, POOL_DEPS, false, undefined, burst([dealt], 0))?.text).toBe(
      `${named(b)} was dealt a facedown boost card.`,
    );
    expect(text({ type: "boostCardDealt", enemyInstanceId: b, instanceId: a } as GameEvent)).toBeUndefined();
  });

  test("a defeated ally placed facedown under the main scheme", () => {
    const defeated = { type: "characterDefeated", instanceId: a, cardId: state.instances[a]!.cardId } as GameEvent;
    const moved = {
      type: "cardMoved",
      instanceId: a,
      cardId: state.instances[a]!.cardId,
      from: { kind: "playArea", playerId: me },
      to: { kind: "tucked", hostInstanceId: state.mainScheme.instanceId },
    } as unknown as GameEvent;
    expect(logLine(moved, state, me, POOL_DEPS, false, undefined, burst([defeated, moved], 1))?.text).toBe(
      `${named(a)} was defeated and placed facedown under ${named(state.mainScheme.instanceId)}.`,
    );
    // Not defeated: an ordinary tuck, worded as one.
    expect(logLine(moved, state, me, POOL_DEPS, false, undefined, burst([moved], 0))?.text).toBe(
      `${named(a)} is tucked under ${named(state.mainScheme.instanceId)}.`,
    );
  });
});

describe("hero pack and box hero events (docs/phase7-wave10-hero-packs.md, -box-heroes.md)", () => {
  let a: string;
  let b: string;
  beforeAll(() => {
    [a, b] = Object.keys(state.instances) as [string, string];
  });
  const named = (id: string): string => state.cardPool[state.instances[id]!.cardId]!.name;
  const burst = (events: GameEvent[], at: number) => ({ events, at });
  const withLine = (event: GameEvent, events: GameEvent[], game: GameState = state) =>
    logLine(event, game, me, POOL_DEPS, false, undefined, burst(events, events.indexOf(event)))?.text;
  /** Instance `id` made a Labor card: an encounter card a player owns, home in that player's Labor deck. */
  const asLabor = (id: string): GameState =>
    ({
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, ownerId: me, home: { kind: "separateDeck", playerId: me, name: "Labor" } },
      },
    }) as unknown as GameState;

  test("a played upgrade with no host is discarded", () => {
    expect(text({ type: "playedUpgradeHasNoHost", instanceId: a, playerId: me } as GameEvent)).toBe(
      `${named(a)} has nothing to attach to, so it is discarded. What was paid stays paid.`,
    );
  });

  test("a card refused by a tuck limit", () => {
    expect(text({ type: "cardNotTucked", instanceId: a, hostInstanceId: b, reason: "limit" } as GameEvent)).toBe(
      `${named(a)} is not tucked under ${named(b)}: it holds no more.`,
    );
  });

  test("a card tucked under another, and discarded from under it", () => {
    const tucked = {
      type: "cardMoved",
      instanceId: a,
      cardId: state.instances[a]!.cardId,
      from: { kind: "hand", playerId: me },
      to: { kind: "tucked", hostInstanceId: b },
    } as unknown as GameEvent;
    expect(withLine(tucked, [tucked])).toBe(`${named(a)} is tucked under ${named(b)}.`);
    const refused = { type: "cardNotTucked", instanceId: a, hostInstanceId: b, reason: "limit" } as GameEvent;
    expect(withLine(tucked, [refused, tucked])).toBeUndefined();
    const out = {
      type: "cardMoved",
      instanceId: a,
      cardId: state.instances[a]!.cardId,
      from: { kind: "tucked", hostInstanceId: b },
      to: { kind: "discard", playerId: me },
    } as unknown as GameEvent;
    expect(withLine(out, [out])).toBe(`${named(a)} is discarded from under ${named(b)}.`);
  });

  test("an interrupt that no longer applies", () => {
    expect(
      text({ type: "interruptConditionLapsed", instanceId: a, abilityId: "x", event: {} } as unknown as GameEvent),
    ).toBe(`${named(a)}'s interrupt does not resolve: the damage it was to answer has changed.`);
  });

  test("a deck discard still counted after a card took it", () => {
    const base = { type: "deckDiscardStillCounted", playerId: me, instanceId: a, slot: "s" };
    expect(text({ ...base, takenByInstanceId: b } as GameEvent)).toBe(
      `${named(a)} was taken by ${named(b)} and still counts as discarded.`,
    );
    expect(text({ ...base, takenByInstanceId: null } as GameEvent)).toBe(
      `${named(a)} was taken from the discard pile and still counts as discarded.`,
    );
  });

  test("a Labor card revealed, discarded for want of a target, sent back, or sent to the victory display", () => {
    const game = asLabor(a);
    expect(
      logLine(
        { type: "encounterCardRevealed", instanceId: a, cardId: "x", playerId: me } as GameEvent,
        game,
        me,
        POOL_DEPS,
      )?.text,
    ).toBe(`You revealed ${named(a)} from your Labor deck.`);
    expect(
      logLine(
        { type: "encounterCardRevealed", instanceId: b, cardId: "x", playerId: me } as GameEvent,
        game,
        me,
        POOL_DEPS,
      )?.text,
    ).toBe(`You revealed ${named(b)}.`);
    expect(
      logLine(
        { type: "revealedCardDiscarded", instanceId: a, cardId: "x", playerId: me, reason: "notAttached" } as GameEvent,
        game,
        me,
        POOL_DEPS,
      )?.text,
    ).toBe(`${named(a)} had nothing to attach to when you revealed it, so it is discarded.`);
    expect(
      logLine(
        {
          type: "returnedToSeparateDeck",
          instanceId: a,
          cardId: "x",
          playerId: me,
          name: "Labor",
          instead: "encounterDiscard",
        } as GameEvent,
        game,
        me,
        POOL_DEPS,
      )?.text,
    ).toBe(`${named(a)} goes back into Your Labor deck, facedown, instead of leaving it.`);
    const victory = {
      type: "cardMoved",
      instanceId: a,
      cardId: "x",
      from: { kind: "playArea", playerId: me },
      to: { kind: "victoryDisplay" },
    } as unknown as GameEvent;
    expect(logLine(victory, game, me, POOL_DEPS)?.text).toBe(`${named(a)} goes to the victory display.`);
    expect(logLine(victory, state, me, POOL_DEPS)).toBeNull();
  });
});
