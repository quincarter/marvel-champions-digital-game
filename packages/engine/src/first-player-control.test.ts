/**
 * docs/phase7-wave3.md §3.13: a card the first player controls (`RuleSpec controlledByFirstPlayer`), a resource ability
 * any player may use (`resource.forAnyPlayer`), and "First Player" actions and interrupts (`firstPlayerOnly`). Synthetic
 * cards shaped like the Milano ("The first player controls the Milano. Piloting — Resource: Exhaust the Milano → generate a
 * [wild] resource for any player."), Blockade ("First Player Action: … remove 3 threat from this scheme.") and the Kree
 * Command Ship ("First Player Interrupt: When a treachery card is revealed from the encounter deck, …").
 *
 * Sources: RRG 1.8 "First Player" (p. 19), "Action" (p. 6), "Resource Ability" (p. 37); MC16 FAQ p. 21 (the Milano).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { controllerOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, UPGRADE } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const self = { kind: "self" } as const;

const MILANO_CONTROL = stubAbility("milano.constant", {
  trigger: { kind: "constant", rules: [{ kind: "controlledByFirstPlayer", target: { self: true } }] },
  effects: [],
});
const PILOTING: AbilityDefinition = {
  trigger: { kind: "resource", forAnyPlayer: true },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
};
const MILANO_PILOTING = stubAbility("milano.resource", PILOTING);
const MILANO = stubSupport({ id: "milano", cost: 0, abilities: [MILANO_CONTROL.ref, MILANO_PILOTING.ref] });

const BLOCKADE_ACTION = stubAbility("blockade.action", {
  trigger: { kind: "action", firstPlayerOnly: true },
  effects: [{ kind: "removeThreat", target: self, amount: { kind: "const", value: 3 } }],
});
const BLOCKADE = stubSideScheme({ id: "blockade", startingThreat: 5, abilities: [BLOCKADE_ACTION.ref] });

const COMMAND_SHIP_INTERRUPT = stubAbility("command-ship.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    firstPlayerOnly: true,
    on: { on: "encounterCardRevealing", targetIs: { categories: ["treachery"] } },
  },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const COMMAND_SHIP = stubEnvironment({ id: "command-ship", abilities: [COMMAND_SHIP_INTERRUPT.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(MILANO_CONTROL, MILANO_PILOTING, BLOCKADE_ACTION, COMMAND_SHIP_INTERRUPT);
const CARDS = [MILANO, BLOCKADE, COMMAND_SHIP, BLANK];
const ENCOUNTER: readonly CardId[] = [BLOCKADE.id, COMMAND_SHIP.id, ...copiesOf(BLANK.id, 30)];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: [MILANO.id, ...copiesOf(UPGRADE.id, 2)],
    players: 2,
  });

const endTurn = (playerId: PlayerId) => ({ type: "endTurn", playerId }) as const;

describe("§3.13 a card the first player controls", () => {
  it("moves to the first player's play area, and follows the first player token when it passes", () => {
    // Put under p2 by surgery: the rule moves it to p1, the first player.
    const placed = playerCardIntoPlay(start(), MILANO.id, P2);
    const settled = driveSession(startSession(placed.state), deps, [endTurn(P1)]);
    // During p2's turn of round 1, p1 is still the first player.
    expect(controllerOf(settled.session.state, placed.id)).toBe(P1);
    expect(mustPlayer(settled.session.state, P1).playArea).toContain(placed.id);
    // p2 ends their turn; the villain phase passes the token to p2.
    const nextRound = driveSession(settled.session, deps, [endTurn(P2)]);
    expect(nextRound.session.state.firstPlayerId).toBe(P2);
    expect(controllerOf(nextRound.session.state, placed.id)).toBe(P2);
    expect(mustPlayer(nextRound.session.state, P2).playArea).toContain(placed.id);
    expect(nextRound.events).toContainEqual(
      expect.objectContaining({ type: "controllerChanged", instanceId: placed.id, from: P1, to: P2 }),
    );
    const replayed = replay(nextRound.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(nextRound.session.state);
  });

  it("its 'for any player' resource ability pays for a card another player plays", () => {
    const placed = playerCardIntoPlay(start(), MILANO.id, P1);
    // p2's turn, with an upgrade (cost 1) in hand.
    let state = driveSession(startSession(placed.state), deps, [endTurn(P1)]).session.state;
    const upgrade = giveCard(state, P2, UPGRADE.id);
    state = upgrade.state;
    const result = applyCommand(
      state,
      {
        type: "playCard",
        playerId: P2,
        cardInstanceId: upgrade.id,
        payment: [{ ability: { instanceId: placed.id, abilityId: MILANO_PILOTING.ref.id } }],
        attachToInstanceId: null,
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(mustInstance(result.state, placed.id).exhausted).toBe(true);
  });
});

describe("§3.13 'First Player' abilities", () => {
  it("a First Player Action on an encounter card is the first player's alone", () => {
    const scheme = encounterCardInVillainArea(start(), BLOCKADE.id, 5);
    const use = (playerId: PlayerId, state: GameState) =>
      applyCommand(
        state,
        { type: "useAbility", playerId, cardInstanceId: scheme.id, abilityId: BLOCKADE_ACTION.ref.id, payment: [] },
        deps,
      );
    const byFirst = use(P1, scheme.state);
    expect(byFirst.ok).toBe(true);
    const p2Turn = driveSession(startSession(scheme.state), deps, [endTurn(P1)]).session.state;
    const byOther = use(P2, p2Turn);
    expect(byOther.ok).toBe(false);
    if (!byOther.ok) expect(byOther.error.message).toContain("first player");
  });

  it("a First Player Interrupt is offered to the first player, whoever revealed the card", () => {
    const ship = encounterCardInVillainArea(start(), COMMAND_SHIP.id);
    const asked: PlayerId[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") asked.push(choice.playerId);
      return defaultPick(state);
    };
    // p2's own dealt card is revealed by p2; the villain's two boost draws come off the top first.
    const stacked = onTopOfEncounterDeck(onTopOfEncounterDeck(ship.state, BLANK.id), BLANK.id);
    driveSession(startSession(stacked), deps, [endTurn(P1), endTurn(P2)], pick);
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked)).toEqual(new Set([P1]));
  });
});
