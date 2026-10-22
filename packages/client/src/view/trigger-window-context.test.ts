import { cardOf, type GameState, type InstanceId, type TriggerEvent } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { playToJackpotWindow } from "../store/dev-jackpot-game.js";
import { SessionStore } from "../store/session-store.js";
import { cardName } from "./names.js";
import {
  deckDiscardWarningOf,
  effectLineOf,
  triggerHeadlineOf,
  triggerWhyNowOf,
  triggerWindowContextOf,
} from "./trigger-window-context.js";

describe("effectLineOf", () => {
  test("reads I Object! as an instruction", () => {
    expect(
      effectLineOf(
        "Jennifer Walters",
        '"I Object!" \u2014 Interrupt: When threat would be placed on a scheme, prevent 1 of that threat. (Limit once per round.)',
      ),
    ).toBe("Use I Object! to prevent 1 of that threat (once per round)");
  });
  test("shows an unfamiliar paragraph whole", () => {
    expect(effectLineOf("Aunt May", "Response: Draw a card.")).toBe("Use Aunt May: Draw a card");
  });
});

describe("a Klaw setup with She-Hulk (the owner's report)", () => {
  let store: SessionStore;
  beforeAll(async () => {
    store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "klaw",
      difficulty: "standard",
      players: [{ starterDeckId: "core-she-hulk-aggression" }],
      seed: 1,
    });
  }, 60_000);

  test("setup-card case: what is about to happen, why now, what yes does", () => {
    const game = store.state.game!;
    const viewer = game.players[0]!.playerId;
    // A real setup game with a reveal frame for the revealed side scheme, whatever the engine leaves pending.
    const scheme = Object.keys(game.instances).find(
      (id) => cardName(game, id as InstanceId) === "Defense Network",
    )! as InstanceId;
    const frame = { kind: "reveal", instanceId: scheme, whenRevealedCancelled: false, effectsCancelled: false };
    const setup = {
      ...game,
      step: { phase: "setup", kind: "drawStartingHands" },
      stack: [frame],
    } as unknown as typeof game;
    const event = {
      kind: "placeThreat",
      schemeInstanceId: scheme,
      amount: 2,
      sourceInstanceId: scheme,
    } as TriggerEvent;
    expect(triggerHeadlineOf(setup, event, "interrupt", viewer)).toBe("Defense Network is about to get 2 threat");
    expect(triggerWhyNowOf(setup, event)).toBe(
      "Setting up: Defense Network was revealed as a setup card, and its When Revealed places threat",
    );
    expect(triggerHeadlineOf(setup, event, "response", viewer)).toBe("Defense Network got 2 threat");
  });

  test("a facedown 'would reveal' window names no card and says no When Revealed is resolving", () => {
    const game = store.state.game!;
    const viewer = game.players[0]!.playerId;
    const card = Object.keys(game.instances)[0]! as InstanceId;
    // The reveal is still at step 1 (`stage: "faceup"`): Scarlet Spider's or Spider-Tingle's window, card facedown.
    const frame = {
      kind: "reveal",
      instanceId: card,
      stage: "faceup",
      whenRevealedCancelled: false,
      effectsCancelled: false,
    };
    const revealing = {
      ...game,
      step: { phase: "villain", kind: "revealEncounterCards" },
      stack: [frame],
    } as unknown as typeof game;
    const event = { kind: "encounterCardBeingRevealed", instanceId: card, playerId: viewer } as TriggerEvent;
    expect(triggerHeadlineOf(revealing, event, "interrupt", viewer)).toBe(
      "A facedown encounter card is about to be revealed",
    );
    expect(triggerWhyNowOf(revealing, event)).toBe("Villain phase");
  });

  test("a real trigger window, when the game offers one, yields a headline and effect lines", () => {
    const game = store.state.game!;
    const choice = game.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return;
    const context = triggerWindowContextOf(game, choice, choice.playerId, POOL_DEPS)!;
    expect(context.headline.length).toBeGreaterThan(0);
    expect(context.effects.every((line) => line.startsWith("Use "))).toBe(true);
  });

  test("an enemy attack and damage to you are worded from the viewer's seat", () => {
    const game = store.state.game!;
    const viewer = game.players[0]!.playerId;
    const enemy = game.players[0]!.identity.instanceId;
    const attack = {
      kind: "enemyAttack",
      enemyInstanceId: enemy,
      attackedPlayerId: viewer,
    } as unknown as TriggerEvent;
    expect(triggerHeadlineOf(game, attack, "interrupt", viewer)).toMatch(/ is about to attack you$/);
    const damage = { kind: "dealDamage", targetInstanceId: enemy, amount: 3 } as unknown as TriggerEvent;
    expect(triggerHeadlineOf(game, damage, "interrupt", viewer)).toBe("You are about to take 3 damage");
    expect(triggerHeadlineOf(game, damage, "response", viewer)).toBe("You took 3 damage");
  });

  // Issue #253: an attack dealt two boost cards opens a window per card; the headline names the card and its icons.
  test("a boost card turned faceup is named, with its icons", () => {
    const game = store.state.game!;
    const viewer = game.players[0]!.playerId;
    const boost = Object.keys(game.instances).find(
      (id) => cardName(game, id as InstanceId) === "Defense Network",
    )! as InstanceId;
    const event = {
      kind: "boostCardTurnedFaceup",
      enemyInstanceId: game.players[0]!.identity.instanceId,
      boostInstanceId: boost,
      activation: "attack",
      boostIcons: 2,
      playerId: viewer,
    } as unknown as TriggerEvent;
    expect(triggerHeadlineOf(game, event, "interrupt", viewer)).toBe(
      "Defense Network is being turned up as a boost card (2 boost icons)",
    );
    expect(triggerHeadlineOf(game, { ...event, boostIcons: 1 } as TriggerEvent, "response", viewer)).toBe(
      "Defense Network was turned up as a boost card (1 boost icon)",
    );
  });

  test("an event with no sentence of its own falls back to the shared words", () => {
    const game = store.state.game!;
    const event = { kind: "deckRanOut" } as unknown as TriggerEvent;
    expect(triggerHeadlineOf(game, event, "response", game.players[0]!.playerId)).toBe(
      "Just happened: a deck running out",
    );
  });
});

describe("effectLineOf, plain names", () => {
  test("Spider-Sense", () => {
    expect(
      effectLineOf(
        "Spider-Man (Peter Parker)",
        "Spider-Sense \u2014 Interrupt: When the villain initiates an attack against you, draw 1 card.",
      ),
    ).toBe("Use Spider-Sense to draw 1 card");
  });
});

describe("a deck discard answered by a response (issue #222: Jackpot! and Luck Be a Lady)", () => {
  let store: SessionStore;
  beforeAll(async () => {
    store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "klaw",
      difficulty: "standard",
      players: [{ starterDeckId: "domino-justice" }],
      seed: 1,
    });
  }, 60_000);

  const named = (name: string): InstanceId => {
    const game = store.state.game!;
    return Object.keys(game.instances).find((id) => cardOf(game, id as InstanceId)?.name === name)! as InstanceId;
  };
  /** The table as the response window sees it: both cards face up in Domino's discard pile. */
  const atWindow = (): GameState => {
    const game = store.state.game!;
    const moved = [named("Jackpot!"), named("Luck Be a Lady")];
    return {
      ...game,
      players: game.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              deck: p.deck.filter((id) => !moved.includes(id)),
              hand: p.hand.filter((id) => !moved.includes(id)),
              discard: [...moved, ...p.discard],
            }
          : p,
      ),
    };
  };
  const discarded = (sourceInstanceId: InstanceId | null, at: "discard" | "deck" = "discard"): TriggerEvent =>
    ({
      kind: "cardDiscardedFromDeck",
      instanceId: named("Jackpot!"),
      playerId: store.state.game!.players[0]!.playerId,
      deck: "player",
      fromTop: true,
      sourceInstanceId,
      at,
    }) as TriggerEvent;

  test("the headline names the card, the deck and the card that discarded it", () => {
    const game = atWindow();
    const viewer = game.players[0]!.playerId;
    expect(triggerHeadlineOf(game, discarded(named("Luck Be a Lady")), "response", viewer)).toBe(
      "Jackpot! was discarded from the top of your deck by Luck Be a Lady",
    );
  });

  test("no warning for an ordinary deck discard: Jackpot! still counts once shuffled back (Q32 = A)", () => {
    expect(deckDiscardWarningOf(atWindow(), discarded(named("Luck Be a Lady")))).toBeNull();
  });

  test("a mission attempt's discard warns that a card taken away won't count for it", () => {
    const game = atWindow();
    const event = discarded(named("Luck Be a Lady"));
    const watched = {
      ...game,
      deckDiscardWindows: [
        {
          frameId: "f1",
          discards: [
            {
              playerId: game.players[0]!.playerId,
              instanceId: named("Jackpot!"),
              sourceInstanceId: named("Luck Be a Lady"),
              at: "discard",
              boundOn: { frameId: "f0", slot: "discarded", takenAwayNotCounted: true },
            },
          ],
        },
      ],
    } as unknown as GameState;
    expect(deckDiscardWarningOf(watched, event)).toBe(
      "Heads up: if Jackpot! leaves the discard pile, it won't count for Luck Be a Lady. Decline to keep it counted.",
    );
    expect(deckDiscardWarningOf(watched, discarded(null))).toBeNull();
    expect(deckDiscardWarningOf(watched, discarded(named("Luck Be a Lady"), "deck"))).toBeNull();
  });
});

describe("the real Jackpot! window after Luck Be a Lady (issue #222)", () => {
  test("the sheet says what was discarded and by what, with no warning: it still counts (Q32 = A)", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await playToJackpotWindow(store);
    const game = store.state.game!;
    const choice = game.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseTriggers");
    const context = triggerWindowContextOf(game, choice, choice.playerId, POOL_DEPS)!;
    expect(context.headline).toBe("Jackpot! was discarded from the top of your deck by Luck Be a Lady");
    expect(context.warning).toBeNull();
  }, 60_000);
});
