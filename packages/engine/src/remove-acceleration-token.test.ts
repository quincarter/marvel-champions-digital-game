/**
 * "Remove an acceleration token from play" (De-escalation, `fne` 60024's When Defeated; docs/phase7-wave11.md §8.2
 * task 13): `EffectSpec removeAccelerationToken { from }` after a `chooseTarget` over `{ hasAccelerationToken: true }`,
 * which is what the DSL's `removeAnAccelerationToken` writes.
 *
 * Sources: RRG 1.8 "Acceleration Token" (p. 5): "Acceleration tokens on the main scheme cannot be removed from play", and
 * tokens "placed on cards other than the main scheme still add threat to the main scheme during step one". A card's
 * instruction to remove one overrides the first under the Golden Rules (p. 4) and "Cannot" (p. 11). The player chooses
 * which token: any main scheme stage's, or one on another card.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO } from "./testing/scenario.js";
import { copiesOf, P1 } from "./testing/wave3.js";

const MAIN = stubMainScheme({
  id: "main",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
/** "When Defeated: Remove an acceleration token from play." — De-escalation's own trigger, on a side scheme. */
const PREY_DEFEATED = stubAbility("prey.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    { kind: "chooseTarget", slot: "token", query: { hasAccelerationToken: true }, chooser: { kind: "controller" } },
    { kind: "removeAccelerationToken", from: { kind: "slot", slot: "token" } },
  ],
});
const PREY = stubSideScheme({ id: "prey", startingThreat: 3, boostIcons: 0, abilities: [PREY_DEFEATED.ref] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const prey: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "prey" } };

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** What `removeAnAccelerationToken()` compiles to. */
const DE_ESCALATE = event("de-escalate", [
  { kind: "chooseTarget", slot: "token", query: { hasAccelerationToken: true }, chooser: { kind: "controller" } },
  { kind: "removeAccelerationToken", from: { kind: "slot", slot: "token" } },
]);
/** The bare effect, as before this task: the central main scheme. */
const BARE = event("bare", [{ kind: "removeAccelerationToken" }]);
const REVEAL_PREY = event("reveal-prey", [
  { kind: "selectCards", slot: "p", cards: { kind: "encounter", zones: ["deck"], filter: { name: "prey" } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "p" }, controller: { kind: "controller" } },
  { kind: "addAccelerationToken", target: prey },
]);
const PLAIN_PREY = event("plain-prey", REVEAL_PREY.ability.definition.effects.slice(0, 2));
const CLEAR_PREY = event("clear-prey", [{ kind: "removeThreat", target: prey, amount: { kind: "const", value: 5 } }]);
const EVENTS = [DE_ESCALATE, BARE, REVEAL_PREY, PLAIN_PREY, CLEAR_PREY];
const deps: EngineDeps = depsOf(PREY_DEFEATED, ...EVENTS.map((e) => e.ability));
const EXTRA = "extra-stage" as InstanceId;

/** One player, `central` tokens on the main scheme; `extra`: a second main scheme stage beside it holding that many. */
function start(central: number, extra?: number): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, MAIN, PREY, VILLAIN, FILLER, ...EVENTS.map((e) => e.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN.id,
      encounterDeck: [...copiesOf(FILLER.id, 20), PREY.id],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const state = driveSession(startSession(result.state), deps).session.state;
  const centralId = state.mainScheme.instanceId;
  // Test surgery: the tokens, and the second stage as a copy of the first (the shape Tower Defense's stage 2 takes).
  return {
    ...state,
    mainScheme: { ...state.mainScheme, accelerationTokens: central },
    ...(extra === undefined
      ? {}
      : {
          instances: { ...state.instances, [EXTRA]: { ...mustInstance(state, centralId), instanceId: EXTRA } },
          extraMainSchemes: [{ ...state.mainScheme, instanceId: EXTRA, accelerationTokens: extra }],
        }),
  };
}

/** Plays `card` for free, answering the token choice with `holder` (by its instance id) when it is asked. */
function play(state: GameState, card: ReturnType<typeof event>, holder?: InstanceId) {
  const given = giveCard(state, P1, card.card.id);
  const asked: (readonly string[])[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTarget") {
      asked.push(choice.options.map((o) => ("instanceId" in o.ref ? o.ref.instanceId : o.optionId)));
      const option = choice.options.find((o) => "instanceId" in o.ref && o.ref.instanceId === holder);
      if (option) return [option.optionId];
    }
    return defaultPick(s);
  };
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { session, state: session.state, events, asked };
}

const preyId = (state: GameState): InstanceId =>
  state.villainArea.find((id) => mustInstance(state, id).cardId === PREY.id)!;
const preyTokens = (state: GameState): number => mustInstance(state, preyId(state)).counters["acceleration"] ?? 0;
const tokenLog = (events: readonly GameEvent[]) =>
  events.filter(
    (e) => e.type === "accelerationTokenAdded" || (e.type === "counterRemoved" && e.counterType === "acceleration"),
  );

describe("removeAccelerationToken: the player chooses any acceleration token in play (§8.2 task 13)", () => {
  it("no token anywhere: the When Defeated asks nothing and changes nothing", () => {
    const withPrey = play(start(0), PLAIN_PREY).state;
    const { state, events, asked } = play(withPrey, CLEAR_PREY);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === PREY_DEFEATED.ref.id)).toBe(true);
    expect(asked).toEqual([]);
    expect(state.mainScheme.accelerationTokens).toBe(0);
    expect(tokenLog(events)).toEqual([]);
    // Control: with a token on the main scheme, the same When Defeated removes it.
    const control = play(play(start(1), PLAIN_PREY).state, CLEAR_PREY, withPrey.mainScheme.instanceId);
    expect(control.state.mainScheme.accelerationTokens).toBe(0);
  });

  it("an action that would remove one cannot be played with no token in play", () => {
    expect(() => play(start(0), DE_ESCALATE)).toThrow("this event has no valid target");
  });

  it("the main scheme's token comes off it, the 'cannot be removed' rule overridden by the card", () => {
    const base = start(2);
    const { state, session, events } = play(base, DE_ESCALATE, base.mainScheme.instanceId);
    expect(state.mainScheme.accelerationTokens).toBe(1);
    expect(tokenLog(events)).toEqual([{ type: "accelerationTokenAdded", total: 1 }]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a token on a side scheme is offered beside the main scheme's, and the chosen one is removed", () => {
    const withPrey = play(start(1), REVEAL_PREY).state;
    expect(preyTokens(withPrey)).toBe(1);
    const { state, events, asked } = play(withPrey, DE_ESCALATE, preyId(withPrey));
    expect(asked).toEqual([[withPrey.mainScheme.instanceId, preyId(withPrey)]]);
    expect(preyTokens(state)).toBe(0);
    expect(state.mainScheme.accelerationTokens).toBe(1);
    expect(tokenLog(events)).toEqual([
      { type: "counterRemoved", instanceId: preyId(withPrey), counterType: "acceleration", amount: 1 },
    ]);
    // Control: choosing the main scheme leaves the side scheme's token.
    const other = play(withPrey, DE_ESCALATE, withPrey.mainScheme.instanceId).state;
    expect(preyTokens(other)).toBe(1);
    expect(other.mainScheme.accelerationTokens).toBe(0);
  });

  it("a second main scheme stage's token: only stages holding one are offered, and the chosen stage loses one", () => {
    const base = start(0, 2);
    const { state, events, asked } = play(base, DE_ESCALATE, EXTRA);
    expect(asked).toEqual([[EXTRA]]);
    expect(state.extraMainSchemes?.[0]?.accelerationTokens).toBe(1);
    expect(state.mainScheme.accelerationTokens).toBe(0);
    expect(tokenLog(events)).toEqual([{ type: "accelerationTokenAdded", total: 1, schemeInstanceId: EXTRA }]);
  });

  it("a separate game area's own main scheme stage: offered, chosen, one removed; the central stage unchanged", () => {
    const base = start(1);
    const AREA_STAGE = "area-stage" as InstanceId;
    // Test surgery: a second game area whose own stage (a copy of the central one) holds 2 tokens.
    const withArea = {
      ...base,
      instances: {
        ...base.instances,
        [AREA_STAGE]: { ...mustInstance(base, base.mainScheme.instanceId), instanceId: AREA_STAGE },
      },
      gameAreas: [
        ...base.gameAreas,
        {
          areaId: "area-b",
          playerIds: [],
          mainScheme: { ...base.mainScheme, instanceId: AREA_STAGE, accelerationTokens: 2 },
          villainIds: [],
          activeVillainId: null,
          sideSchemeIds: [],
          formerSchemeIds: [],
        },
      ],
    } as unknown as GameState;
    const { state, events, asked } = play(withArea, DE_ESCALATE, AREA_STAGE);
    expect(asked).toEqual([[base.mainScheme.instanceId, AREA_STAGE]]);
    expect(state.gameAreas.find((a) => a.mainScheme?.instanceId === AREA_STAGE)?.mainScheme?.accelerationTokens).toBe(
      1,
    );
    expect(state.mainScheme.accelerationTokens).toBe(1);
    expect(tokenLog(events)).toEqual([{ type: "accelerationTokenAdded", total: 1, schemeInstanceId: AREA_STAGE }]);
  });

  it("the bare effect still takes one off the central main scheme only", () => {
    const off = play(start(1, 1), BARE).state;
    expect(off.mainScheme.accelerationTokens).toBe(0);
    expect(off.extraMainSchemes?.[0]?.accelerationTokens).toBe(1);
    const none = play(start(0, 1), BARE);
    expect(none.state.extraMainSchemes?.[0]?.accelerationTokens).toBe(1);
    expect(tokenLog(none.events)).toEqual([]);
  });
});
