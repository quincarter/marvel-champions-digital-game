/**
 * An identity's own defeat now threads the same `fromAttack`/`sourceInstanceId`/`defeatedByPlayerId` hint the
 * ally/minion and villain defeat paths already carried (`checkDefeats`, `packages/engine/src/resolve/defeat.ts`),
 * closing the gap `ron` 90002's own docblock (`packages/cards/src/wave3/ron/kree-fanatic.ts`) documented: an
 * identity defeated by an enemy's attack previously carried no `fromAttack`/`sourceIs`-matchable context at all,
 * so "a friendly character is defeated by an enemy attack" (Judge, Jury, Executioner) could not be restricted to
 * "by an *attack*" for an identity the way it now can be for an ally.
 *
 * Synthetic cards shaped like Judge, Jury, Executioner (`ron` 90002): "Forced Response: After a friendly character
 * is defeated by an enemy attack, place 2 threat on the main scheme."
 *
 * **A two-player table, and Judge, Jury, Executioner staged as a side scheme (in the villain area), not a
 * player-owned support — both deliberate.** An identity's own defeat applies (`applyDefeat`, `resolve/event.ts`)
 * during the event frame's own "apply" stage, which eliminates that player *before* the frame's response window
 * opens — the same order an ally's own defeat uses, except an ally's defeat never ends the game. Two traps that
 * looked like this fix not working, both about staging rather than the fix itself: (1) in a solo game the defeated
 * player is always the last one, `runFlow`'s own `if (ctx.state.outcome …) return` (`flow.ts`) stops the stack the
 * moment that elimination sets a loss, and the response frame — already re-staged to "responses" — never gets
 * driven (correct: RRG 1.8 has no "keep resolving after the game is already lost" rule, and that response can no
 * longer matter anyway) — a second, unaffected player keeps the game going instead; (2) `eliminatePlayer` discards
 * every card *that player owns* in their own play area, so a stub of Judge, Jury, Executioner built as p1's own
 * `stubSupport` was removed from play by that very cleanup before its own response window opened — the real card
 * is a side scheme (module docblock, `wave3/ron/kree-fanatic.ts`: "an unowned side scheme, no controller to be
 * 'you'"), in the villain area, unaffected by any one player's elimination, so the fixture is staged there too.
 *
 * Sources: RRG 1.8 "Defeat" (p. 15); docs/phase7-wave3.md §3.45 (Regroup, the same `fromAttack` hint for allies).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const JJE_RESPONSE = stubAbility("jje.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "characterDefeated",
      targetIs: { categories: ["identity", "ally"] },
      fromAttack: true,
      sourceIs: { categories: ["enemy"] },
    },
  },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
});
const JJE = stubSideScheme({ id: "jje", startingThreat: 0, abilities: [JJE_RESPONSE.ref] });

/** "The villain attacks you." — a 0-cost event so a test can trigger a real villain attack on demand. */
const SMITE_ACTION = stubAbility("smite.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
});
const SMITE = stubEvent({ id: "smite", cost: 0, abilities: [SMITE_ACTION.ref] });

/** A non-attack damage source: deals damage directly to your own identity, well past its remaining hit points. */
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 99 },
    },
  ],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });

/** "You are defeated", with no damage (the shape of Creeping Corruption's 65072b). */
const DOOM_ACTION = stubAbility("doom.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "defeat", target: { kind: "identityOf", player: { kind: "controller" } } }],
});
const DOOM = stubEvent({ id: "doom", cost: 0, abilities: [DOOM_ACTION.ref] });

/** Damage placed rather than dealt: nothing names a card for the defeat that follows. */
const PLACE_ACTION = stubAbility("place.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "placeDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 99 },
    },
  ],
});
const PLACE = stubEvent({ id: "place", cost: 0, abilities: [PLACE_ACTION.ref] });

const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 1 });

const deps: EngineDeps = depsOf(JJE_RESPONSE, SMITE_ACTION, ZAP_ACTION, DOOM_ACTION, PLACE_ACTION);
const CARDS = [JJE, SMITE, ZAP, DOOM, PLACE, RECRUIT];
const DECK: readonly CardId[] = [SMITE.id, ZAP.id, DOOM.id, PLACE.id, RECRUIT.id];
const ENCOUNTER: readonly CardId[] = copiesOf(JJE.id, 1);

/** A two-player game with Judge, Jury, Executioner already in the villain area (a side scheme, unowned by either
 * player — module docblock), both players in hero form. */
function table(): GameState {
  return encounterCardInVillainArea(heroes(ENCOUNTER), JJE.id).state;
}

/** The same table with nothing in play that hears a defeat, so an identity's falls inline in the sweep. */
const quietTable = (): GameState => heroes(copiesOf(JJE.id, 5));

function heroes(encounter: readonly CardId[]): GameState {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, encounter, players: 2 });
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
}

describe("an identity's own defeat carries the same fromAttack hint an ally's already does", () => {
  it("defeated by the villain's own attack: the Forced Response fires (2 threat placed)", () => {
    const state = table();
    const identity = state.players[0]!.identity.instanceId;
    const primed: GameState = {
      ...state,
      instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage: 9 } },
    };
    const { state: after, session } = playFree(primed, deps, SMITE.id, P1);
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(2);
    // p1 is out, but p2 keeps the game going — the whole point of a two-player table here.
    expect(after.outcome).toBeNull();
    expect(after.players.find((p) => p.playerId === P1)?.eliminated).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("defeated by non-attack damage: the Forced Response does not fire (no threat placed)", () => {
    const state = table();
    const { state: after } = playFree(state, deps, ZAP.id, P1);
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(0);
  });

  it("an ally defeated by the villain's own attack: the Forced Response fires too (2 threat placed)", () => {
    const base = table();
    const recruit = playerCardIntoPlay(base, RECRUIT.id, P1);
    const given = giveCard(recruit.state, P1, SMITE.id);
    // Declare the ally as defender the moment `declareDefender` is offered; answer everything else as usual.
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") {
        const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === recruit.id);
        return defend ? [defend.optionId] : ["decline"];
      }
      return defaultPick(state);
    };
    const { state: after } = runCommandsPicking(given.state, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(2);
  });
});

describe("the logged identity defeat says what defeated it", () => {
  /** Plays `card` from p1's hand at no cost, on `state`; the instance is the card that was played. */
  function play(state: GameState, card: CardId) {
    const given = giveCard(state, P1, card);
    const { state: after, events } = runCommandsPicking(given.state, deps, defaultPick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    return { after, events, played: given.id };
  }
  const identityOf = (state: GameState) => state.players[0]!.identity.instanceId;
  const logged = (events: readonly GameEvent[]) => events.filter((e) => e.type === "characterDefeated");
  const announced = (events: readonly GameEvent[]) =>
    events.some((e) => e.type === "triggerEvent" && e.event.kind === "characterDefeated");
  /** p1's identity one hit point from defeat. */
  const primed = (state: GameState): GameState => {
    const identity = identityOf(state);
    return { ...state, instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage: 9 } } };
  };

  it.each([
    ["inline in the sweep", quietTable, false],
    ["through its event, when an ability hears the defeat", table, true],
  ])("attack damage names the attacker and fromAttack, %s", (_, start, heard) => {
    const state = primed(start());
    const { after, events } = play(state, SMITE.id);
    expect(announced(events)).toBe(heard);
    expect(logged(events)).toEqual([
      {
        type: "characterDefeated",
        instanceId: identityOf(state),
        cardId: mustInstance(state, identityOf(state)).cardId,
        sourceInstanceId: after.villains[0]!.instanceId,
        fromAttack: true,
        sourceRole: "villain",
      },
    ]);
  });

  it("a card effect's damage names that card, and no fromAttack", () => {
    const state = quietTable();
    const { events, played } = play(state, ZAP.id);
    expect(logged(events)).toEqual([
      {
        type: "characterDefeated",
        instanceId: identityOf(state),
        cardId: mustInstance(state, identityOf(state)).cardId,
        sourceInstanceId: played,
      },
    ]);
  });

  it("a `defeat` effect names the card whose ability defeats the hero, and no fromAttack", () => {
    const state = quietTable();
    const { events, played } = play(state, DOOM.id);
    expect(events.some((e) => e.type === "damageDealt")).toBe(false);
    expect(logged(events)).toEqual([
      {
        type: "characterDefeated",
        instanceId: identityOf(state),
        cardId: mustInstance(state, identityOf(state)).cardId,
        sourceInstanceId: played,
      },
    ]);
  });

  it("damage placed names nothing: no damage event told the sweep what it was", () => {
    const state = quietTable();
    const { events } = play(state, PLACE.id);
    expect(logged(events)).toEqual([
      {
        type: "characterDefeated",
        instanceId: identityOf(state),
        cardId: mustInstance(state, identityOf(state)).cardId,
      },
    ]);
  });
});
