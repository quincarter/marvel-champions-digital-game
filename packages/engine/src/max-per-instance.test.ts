/**
 * docs/phase7-wave5.md §3.14: "(Max 1 per [instance])". Synthetic cards shaped like Web-Bracelet (`sm` 27024: "(Max 1
 * per event.)").
 *
 * Source: RRG 1.8 "Max 1 per [instance]" (p. 28): "restricts the number of times an ability can be triggered by a single
 * instance of a triggering effect across all copies of the card with the maximum. (For example, if an ability has the
 * text '(Max 1 per event.),' only one card with that ability can be triggered per event played.)"
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { runCommandsPicking } from "./testing/drive.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const bracelet = (forced: boolean): AbilityDefinition => ({
  trigger: {
    kind: "response",
    forced,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "charge", amount: { kind: "const", value: 1 } },
  ],
  limit: { count: 1, period: "phase", per: "triggeringEvent" },
});
const FORCED_BRACELET = stubAbility("forced-bracelet.response", bracelet(true));
const OPTIONAL_BRACELET = stubAbility("optional-bracelet.response", bracelet(false));
const FORCED = stubSupport({ id: "forced-bracelet", cost: 0, abilities: [FORCED_BRACELET.ref] });
const OPTIONAL = stubSupport({ id: "optional-bracelet", cost: 0, abilities: [OPTIONAL_BRACELET.ref] });

const NOTHING = stubAbility("nothing.action", { trigger: { kind: "action" }, effects: [] });
const EVENT = stubEvent({ id: "nothing", cost: 0, abilities: [NOTHING.ref] });

const deps: EngineDeps = depsOf(FORCED_BRACELET, OPTIONAL_BRACELET, NOTHING);

function start(bracelet: typeof FORCED): GameState {
  let state = gameAtFirstTurn({
    cards: [FORCED, OPTIONAL, EVENT],
    deps,
    deck: [...copiesOf(bracelet.id, 2), ...copiesOf(EVENT.id, 3)],
  });
  state = playerCardIntoPlay(state, bracelet.id).state;
  return playerCardIntoPlay(state, bracelet.id).state;
}

const charges = (state: GameState, bracelet: typeof FORCED): number =>
  mustPlayer(state, P1)
    .playArea.filter((id) => mustInstance(state, id).cardId === bracelet.id)
    .reduce((sum, id) => sum + (mustInstance(state, id).counters["charge"] ?? 0), 0);

describe("§3.14 '(Max 1 per event.)' across copies", () => {
  it("two forced copies: only one resolves per event, and the next event triggers one again; replay deep-equal", () => {
    const once = playFree(start(FORCED), deps, EVENT.id);
    expect(charges(once.state, FORCED)).toBe(1);
    const twice = playFree(once.state, deps, EVENT.id);
    expect(charges(twice.state, FORCED)).toBe(2);
    const replayed = replay(twice.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(twice.session.state);
  });

  it("two optional copies, both chosen at once: only the first resolves for that event", () => {
    const state = start(OPTIONAL);
    const given = giveCard(state, P1, EVENT.id);
    let offered = 0;
    const pickAll = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") {
        offered++;
        return choice.options.map((o) => o.optionId);
      }
      return defaultPick(s);
    };
    const after = runCommandsPicking(given.state, deps, pickAll, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    expect(offered).toBe(1);
    expect(charges(after, OPTIONAL)).toBe(1);
  });
});
