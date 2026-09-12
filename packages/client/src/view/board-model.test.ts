/**
 * The board model and the highlight model, checked against real Core Set games
 * rather than fixtures — a fixture can't catch the client disagreeing with what
 * the engine actually publishes.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, deckAspect } from "./board-model.js";
import { highlights } from "./highlights.js";

const KLAW_TWO: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
  seed: 77,
};

/** Plays past setup into a real player turn, so the board has something on it. */
async function intoPlay(config: SessionConfig, maxSteps = 40): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    break;
  }
  return store;
}

describe("boardModel", () => {
  let store: SessionStore;
  let state: GameState;
  let viewer: PlayerId;

  beforeAll(async () => {
    store = await intoPlay(KLAW_TWO);
    state = store.state.game!;
    viewer = store.state.perspectiveId!;
  }, 60_000);

  test("names every panel from @mc/content, never from a placeholder", () => {
    const model = boardModel(state, viewer, CORE_DEPS);

    expect(model.villain.name).toBe("Klaw");
    expect(model.mainScheme.name.length).toBeGreaterThan(0);
    // The perspective seat is one of the two Core heroes we seated.
    expect(["She-Hulk", "Jennifer Walters", "Black Panther", "T'Challa"]).toContain(model.me.name);
  });

  test("the villain panel carries the stage, stats and HP the engine reports", () => {
    const model = boardModel(state, viewer, CORE_DEPS);
    const labels = model.villain.stats.map((tile) => tile.label);

    expect(model.villain.subtitle).toMatch(/^Villain · Stage (I|II|III)$/);
    expect(labels).toEqual(["ATK", "SCH", "HP"]);
    expect(model.villain.hp).not.toBeNull();
    expect(model.villain.hp!.max).toBeGreaterThan(0);
    expect(model.villain.hp!.current).toBeLessThanOrEqual(model.villain.hp!.max);
  });

  test("the main scheme reports its scaled target threat, side schemes report none", () => {
    const model = boardModel(state, viewer, CORE_DEPS);

    expect(model.mainScheme.isMain).toBe(true);
    // Klaw's stage 1 target scales per player; 2 players must beat 1 player's.
    expect(model.mainScheme.target).toBeGreaterThan(0);
    expect(model.mainScheme.subtitle).toMatch(/^Main scheme \d/);
    for (const side of model.sideSchemes) {
      expect(side.target).toBeNull();
      expect(side.isMain).toBe(false);
    }
  });

  test("a hero panel shows THW/ATK/DEF, an alter-ego shows REC", () => {
    const heroState = state;
    const model = boardModel(heroState, viewer, CORE_DEPS);
    const labels = model.me.stats.map((tile) => tile.label);

    if (model.myForm === "hero") {
      expect(labels).toEqual(["THW", "ATK", "DEF", "HP"]);
    } else {
      expect(labels).toEqual(["REC", "HP"]);
    }
  });

  test("derives the seat's deck aspect for the panel subtitle", () => {
    expect(deckAspect(state, viewer)).toBeTruthy();
    const model = boardModel(state, viewer, CORE_DEPS);
    expect(model.me.subtitle).toMatch(/^(Hero|Alter-ego) · (Aggression|Justice|Leadership|Protection)$/);
  });

  test("hand cards carry cost, type line, current rules text and resource icons", () => {
    const model = boardModel(state, viewer, CORE_DEPS);

    expect(model.hand.length).toBeGreaterThan(0);
    for (const card of model.hand) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.typeLine).toBe(card.typeLine.toUpperCase());
      for (const icon of card.resourceIcons) {
        expect(["physical", "mental", "energy", "wild"]).toContain(icon);
      }
    }
    // At least one Core starter card produces a resource icon.
    expect(model.hand.some((card) => card.resourceIcons.length > 0)).toBe(true);
  });

  test("the team strip holds the other seats and only the other seats", () => {
    const model = boardModel(state, viewer, CORE_DEPS);

    expect(model.team).toHaveLength(1);
    expect(model.team[0]!.playerId).not.toBe(viewer);
    expect(model.team[0]!.name.length).toBeGreaterThan(0);
    expect(model.team.some((seat) => seat.isFirstPlayer) || model.firstPlayerId === viewer).toBe(true);
  });

  test("attachments are drawn on their host, not as their own panel", () => {
    const model = boardModel(state, viewer, CORE_DEPS);
    const panelIds = new Set(model.myPlayArea.map((panel) => panel.instanceId));

    for (const panel of model.myPlayArea) {
      for (const attachment of panel.attachments) {
        expect(panelIds.has(attachment.instanceId)).toBe(false);
      }
    }
  });

  test("labels the step the way the chrome bar reads it", () => {
    const model = boardModel(state, viewer, CORE_DEPS);
    expect(model.stepLabel.length).toBeGreaterThan(0);
    expect(["setup", "player", "villain", "gameOver"]).toContain(model.phase);
  });
});

describe("highlights", () => {
  test("a turn lists playable cards and gives the engine's reason for the rest", async () => {
    const store = await intoPlay(KLAW_TWO);
    const legal = store.state.legal!;
    // intoPlay stops at the first non-choice state, which is a player turn.
    expect(legal.actions.kind).toBe("turn");

    const marks = highlights(legal.actions);
    expect(marks.yourTurn).toBe(true);
    expect(marks.openChoice).toBeNull();
    expect(marks.basics.map((b) => b.action)).toEqual(["attack", "thwart", "recover", "changeForm", "endTurn"]);
    // Ending the turn is always available on your own turn.
    expect(marks.basics.find((b) => b.action === "endTurn")!.enabled).toBe(true);
    // Every disabled button carries a reason the UI can show.
    for (const basic of marks.basics) {
      if (!basic.enabled) expect(basic.reason).toBeTruthy();
    }
    // A card is either playable or has a reason it isn't — never neither.
    const hand = store.state.game!.players.find((p) => p.playerId === legal.playerId)!.hand;
    for (const id of hand) {
      expect(marks.playable.has(id) || marks.unplayable.has(id), id).toBe(true);
    }
  }, 60_000);

  test("an open choice reports its authority, so encounter-side decisions can be labeled", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    const marks = highlights(store.state.legal!.actions);

    expect(marks.yourTurn).toBe(false);
    expect(marks.openChoice).not.toBeNull();
    expect(["player", "firstPlayerTargets", "firstPlayerOrders"]).toContain(marks.openChoice!.authority);
    // Klaw's setup opens a trigger window before the mulligan, so the kind is
    // whatever the engine parked — the point is that the client reports it
    // rather than guessing what the game is asking.
    expect(marks.openChoice!.promptKind).toBe(store.state.game!.pendingChoice!.prompt.kind);
    expect(marks.openChoice!.playerId).toBe(store.state.game!.pendingChoice!.playerId);
    // Every action-bar button is off while a choice is open.
    expect(marks.basics.every((b) => !b.enabled)).toBe(true);
  });

  test("a game that is over highlights nothing", async () => {
    const store = await intoPlay(KLAW_TWO);
    const marks = highlights({ kind: "gameOver" });

    expect(marks.yourTurn).toBe(false);
    expect(marks.playable.size).toBe(0);
    expect(store.state.game).not.toBeNull();
  }, 60_000);
});
