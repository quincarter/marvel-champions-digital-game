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

const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 1 });

const deps: EngineDeps = depsOf(JJE_RESPONSE, SMITE_ACTION, ZAP_ACTION);
const CARDS = [JJE, SMITE, ZAP, RECRUIT];
const DECK: readonly CardId[] = [SMITE.id, ZAP.id, RECRUIT.id];
const ENCOUNTER: readonly CardId[] = copiesOf(JJE.id, 1);

/** A two-player game with Judge, Jury, Executioner already in the villain area (a side scheme, unowned by either
 * player — module docblock), both players in hero form. */
function table(): GameState {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, encounter: ENCOUNTER, players: 2 });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  return encounterCardInVillainArea(hero, JJE.id).state;
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
