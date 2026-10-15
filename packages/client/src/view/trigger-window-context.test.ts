import type { InstanceId, TriggerEvent } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { cardName } from "./names.js";
import { effectLineOf, triggerHeadlineOf, triggerWhyNowOf, triggerWindowContextOf } from "./trigger-window-context.js";

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
