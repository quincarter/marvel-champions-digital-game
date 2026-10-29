import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { startOffTurnDevGame } from "../store/dev-off-turn-game.js";
import { SessionStore } from "../store/session-store.js";
import { optionArtInstance, optionArtOf } from "./choice-option-art.js";

describe("a text row's picture", () => {
  test("a player is their identity card, a card in play is itself, and a bare option has none", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOffTurnDevGame(store);
    const game = store.state.game!;
    const [p1] = game.players;
    expect(optionArtInstance(game, { kind: "player", playerId: p1!.playerId })).toBe(p1!.identity.instanceId);
    expect(optionArtOf(game, { kind: "player", playerId: p1!.playerId })).not.toBeNull();
    const scheme = game.mainScheme.instanceId;
    expect(optionArtInstance(game, { kind: "card", instanceId: scheme })).toBe(scheme);
    expect(optionArtOf(game, { kind: "card", instanceId: scheme })).not.toBeNull();
    expect(optionArtInstance(game, { kind: "none" })).toBeNull();
    expect(optionArtInstance(game, { kind: "cardDefinition", cardId: "01001a" as CardId })).toBeNull();
    expect(optionArtInstance(game, { kind: "card", instanceId: "nope" as InstanceId })).toBeNull();
  });
});
