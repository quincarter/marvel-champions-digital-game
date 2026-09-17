/**
 * The board model and the highlight model, checked against real Core Set games
 * rather than fixtures — a fixture can't catch the client disagreeing with what
 * the engine actually publishes.
 */

import { activeEncounterDeck } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, characterPanel, deckAspect, faceOf, schemePanel } from "./board-model.js";
import { artFor, CARD_BACKS } from "../art/art-source.js";
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
      /**
       * ...but "no threshold" is not "no progress". Reported from play: "Sub
       * schemes don't have progress bars like the main scheme. Is this by
       * design?" A side scheme is defeated by thwarting it to 0, so the meter
       * is drawn against the threat it entered play with and empties as the
       * players clear it. It must never be below the threat now on it, or the
       * bar would overflow its own box when an effect adds threat.
       */
      expect(side.meterMax).not.toBeNull();
      expect(side.meterMax!).toBeGreaterThan(0);
      expect(side.meterMax!).toBeGreaterThanOrEqual(side.threat);
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

describe("seat rows and what is aimed at a seat", () => {
  let state: GameState;
  let viewer: PlayerId;

  beforeAll(async () => {
    const store = await intoPlay(KLAW_TWO);
    state = store.state.game!;
    viewer = store.state.perspectiveId!;
  }, 60_000);

  const otherSeat = () => state.players.find((player) => player.playerId !== viewer)!;

  test("an eliminated seat is never shown as having finished its turn", () => {
    const seat = otherSeat();
    // Mid player phase, after that seat would have gone: exactly when "done" used to show.
    const eliminated: GameState = {
      ...state,
      players: state.players.map((player) => (player.playerId === seat.playerId ? { ...player, eliminated: true } : player)),
      step: { phase: "player", kind: "turn", activePlayerId: viewer, remainingPlayerIds: [] },
    };
    const row = boardModel(eliminated, viewer, CORE_DEPS).team[0]!;

    expect(row.eliminated).toBe(true);
    expect(row.done).toBe(false);
    expect(row.identityInstanceId).toBe(seat.identity.instanceId);
  });

  test("a lingering 'next card costs less' shows on the chosen seat, and only there", () => {
    const seat = otherSeat();
    const reduced: GameState = {
      ...state,
      lastingEffects: [
        ...state.lastingEffects,
        { id: "test-helicarrier", kind: "costReduction", playerId: seat.playerId, amount: 1, duration: { kind: "endOfPhase" } },
      ],
    };
    const model = boardModel(reduced, viewer, CORE_DEPS);

    expect(model.team[0]!.effects).toEqual(["next card costs 1 less"]);
    expect(model.me.effects).toEqual([]);
    expect(characterPanel(reduced, seat.identity.instanceId, CORE_DEPS).effects).toEqual(["next card costs 1 less"]);
  });

  test("a card played under another player's control names the seat it came from", () => {
    const seat = otherSeat();
    const lentId = seat.hand[0]!;
    const lent: GameState = {
      ...state,
      instances: { ...state.instances, [lentId]: { ...state.instances[lentId]!, ownerId: seat.playerId, controllerId: viewer, faceup: true } },
      players: state.players.map((player) => {
        if (player.playerId === viewer) return { ...player, playArea: [...player.playArea, lentId] };
        if (player.playerId === seat.playerId) return { ...player, hand: player.hand.filter((id) => id !== lentId) };
        return player;
      }),
    };
    const lender = boardModel(lent, seat.playerId, CORE_DEPS);
    const mine = boardModel(lent, viewer, CORE_DEPS).myPlayArea.find((panel) => panel.instanceId === lentId)!;
    const lenderName = boardModel(lent, viewer, CORE_DEPS).team[0]!.name;

    expect(mine.ownerName).toBe(lenderName);
    expect(lender.team[0]!.borrowed).toEqual([`${mine.name} · from ${lenderName}`]);
    // A card you own and control yourself carries no such note.
    expect(boardModel(state, viewer, CORE_DEPS).myPlayArea.every((panel) => panel.ownerName === null)).toBe(true);
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

describe("your own upgrades", () => {
  test("an upgrade attached to your identity shows in your play area", async () => {
    const store = await intoPlay(KLAW_TWO);
    const state = store.state.game!;
    const me = store.state.perspectiveId!;
    const player = state.players.find((seat) => seat.playerId === me)!;

    const model = boardModel(state, me, CORE_DEPS);
    const shown = new Set(model.myPlayArea.map((panel) => panel.instanceId));
    for (const id of player.playArea) {
      const attachedTo = state.instances[id]!.attachedTo;
      // Attached to your own identity, or to nothing: either way it is a card
      // you played and must be able to find again.
      if (attachedTo === null || attachedTo === player.identity.instanceId) {
        expect(shown.has(id)).toBe(true);
      }
    }
  });
});

describe("facedown cards", () => {
  test("a facedown encounter card shows a deck back, never its own face", async () => {
    const store = await intoPlay(KLAW_TWO);
    const state = store.state.game!;
    const me = store.state.perspectiveId!;

    const hidden = activeEncounterDeck(state).deck[0]!;
    const face = faceOf(state, hidden);
    expect(face.kind).toBe("back");

    // The card it *is* must not be reachable through what we draw for it.
    const ownFront = artFor(state.cardPool[state.instances[hidden]!.cardId], { kind: "front" });
    const drawn = artFor(state.cardPool[state.instances[hidden]!.cardId], face);
    expect(drawn).not.toBeNull();
    expect(drawn!.url).not.toEqual(ownFront?.url);
    expect(drawn!.url).toBe(CARD_BACKS.encounter.url);
  });

  test("a card from a player's deck shows the player back", async () => {
    const store = await intoPlay(KLAW_TWO);
    const state = store.state.game!;
    const me = store.state.perspectiveId!;
    const inDeck = state.players.find((player) => player.playerId === me)!.deck[0]!;

    // Ownership, not the card's type: which deck it came from is not a secret.
    expect(artFor(undefined, faceOf(state, inDeck))).toEqual(CARD_BACKS.player);
  });
});

describe("stat buffs", () => {
  /**
   * Reported from play: "If a hero is buffed by stuff, we should show that as
   * well." Heroic Intuition — "Your hero gets +1 THW" — is a real constant
   * ability on a real upgrade, so this goes through the engine's actual
   * modifier path rather than a crafted state.
   */
  test("a constant +1 THW shows as a bonus on the tile, on top of the printed value", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 43523,
    });
    const settle = async (): Promise<void> => {
      for (let step = 0; step < 10; step++) {
        const legal = store.state.legal;
        if (!legal || legal.actions.kind !== "choice") return;
        const { choice } = legal.actions;
        await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      }
    };
    const turnActions = () => {
      const legal = store.state.legal;
      return legal && legal.actions.kind === "turn" ? legal.actions.legal : [];
    };

    await settle();
    const game = () => store.state.game!;
    const intuition = turnActions().find(
      (entry) =>
        entry.action.kind === "playCard" &&
        game().cardPool[game().instances[entry.action.instanceId]!.cardId]?.name === "Heroic Intuition",
    );
    expect(intuition).toBeDefined();
    await store.dispatch(intuition!.example);
    await settle();
    const flip = turnActions().find((entry) => entry.action.kind === "changeForm");
    expect(flip).toBeDefined();
    await store.dispatch(flip!.example);
    await settle();

    const me = boardModel(game(), store.state.perspectiveId!, CORE_DEPS).me;
    const thw = me.stats.find((tile) => tile.label === "THW")!;
    expect(thw.bonus).toBe(1);
    // Spider-Man prints THW 1; the tile carries the engine's modified value.
    expect(thw.value).toBe("2");
    for (const tile of me.stats.filter((other) => other.label !== "THW")) expect(tile.bonus).toBe(0);
  }, 60_000);
});

describe("facedown minions", () => {
  /**
   * Regression: a facedown Drone has no printed stats — its ATK 1 / SCH 1 /
   * HP 1 all come from base overrides — so measuring a bonus against
   * `printedProfile`'s zeros drew a "+1" buff on every Drone. Played out in a
   * real Ultron game, and it fails loudly if no Drone ever appears rather than
   * passing on an empty loop.
   */
  test("a facedown Drone's base-set stats are not shown as buffs", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 11,
    });
    let drone: InstanceId | undefined;
    for (let step = 0; step < 400 && !store.state.game!.outcome && !drone; step++) {
      const legal = store.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      } else if (legal.actions.kind === "turn") {
        const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
        if (!end) break;
        await store.dispatch(end.example);
      } else break;
      drone = Object.values(store.state.game!.instances).find((instance) => instance.facedownAs?.kind === "minion")?.instanceId;
    }

    expect(drone).toBeDefined();
    const panel = characterPanel(store.state.game!, drone!, CORE_DEPS);
    expect(panel.stats.length).toBeGreaterThan(0);
    for (const tile of panel.stats) expect(tile.bonus).toBe(0);
  }, 120_000);
});

describe("a card tucked under a scheme", () => {
  /**
   * RRG "Tuck": Highway Robbery (`01166`, Core) and Doctor Strange's Open the
   * Dark Dimension (`09029`, wave 1) both place a card facedown under a side
   * scheme. `CardInstance.tucked` already tracked this; nothing on the board
   * ever read it, so a card genuinely in play (out of the deck, out of the
   * discard) was invisible everywhere (PLAN.md Phase 7's Invocation-deck
   * bug report: "a card held under Open the Dark Dimension shown as held
   * there"). Only the *count* is shown — a tucked card is hidden information
   * (`view/visibility.ts`), the same "present, not named" treatment
   * `boostCount` already gives a facedown boost card — so this is exercised
   * with a synthetic instance rather than a real reveal, the same way
   * `packages/engine/src/separate-deck.test.ts` proves the engine half with
   * a synthetic "Open the Dark Dimension" fixture.
   */
  test("schemePanel reports how many cards are tucked under it, without naming them", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2 });
    const state = store.state.game!;
    const schemeId = state.mainScheme.instanceId;
    const hiddenId = state.players[0]!.deck[0]!;
    const tucked: GameState = {
      ...state,
      instances: { ...state.instances, [schemeId]: { ...state.instances[schemeId]!, tucked: [hiddenId] } },
    };
    const panel = schemePanel(tucked, schemeId, CORE_DEPS, true);
    expect(panel.tuckedCount).toBe(1);
    expect(panel.subtitle).toContain("1 tucked");
    // Hidden information stays hidden: nothing on the panel names the card.
    expect(JSON.stringify(panel)).not.toContain(hiddenId as unknown as string);
  });
});
