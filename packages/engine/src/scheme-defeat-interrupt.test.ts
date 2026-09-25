/**
 * docs/phase7-wave4.md §3.37: "Interrupt: When attached side scheme is defeated" (Chance Encounter, `vision` 26034 /
 * `fne` 60025; Followed, `cap` 03032; Ambush, `deadpool` 44051; Twisted Reality, `trors` 04135). The defeat has an
 * interrupt window while the scheme and its attachments are still in play; its When Defeated and its leaving play come
 * after; "after … is defeated" responds after both.
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25), "When Defeated Abilities" (p. 48: a forced interrupt, and the card "leaves play
 * after its 'When Defeated' ability is resolved").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { driveSession } from "./testing/drive.js";
import { giveCard } from "./testing/scenario.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const hostDefeated = { on: "schemeDefeated", targetIs: { hostOfSelf: true } } as const;
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType,
  amount: { kind: "const", value: 1 },
});
/** "Interrupt: When attached side scheme is defeated": counts, and records that the scheme is still in play. */
const FOLLOWED_INTERRUPT = stubAbility("followed.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: hostDefeated },
  effects: [
    count("interrupted"),
    {
      kind: "if",
      condition: { kind: "exists", query: { categories: ["sideScheme"] } },
      then: [count("schemeStillInPlay")],
    },
  ],
});
/** The same as a response: by then the attachment has left play with its scheme, so it never fires. */
const LATE_RESPONSE = stubAbility("late.response", {
  trigger: { kind: "response", forced: true, on: hostDefeated },
  effects: [count("responded")],
});
const FOLLOWED = {
  ...stubUpgrade({ id: "followed", cost: 0, abilities: [FOLLOWED_INTERRUPT.ref, LATE_RESPONSE.ref] }),
  attachesTo: { kind: "sideScheme" },
} as const;
const SCHEME = stubSideScheme({ id: "side", startingThreat: 1 });
const THWART = stubAbility("thwart.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "removeThreat",
      target: { kind: "each", query: { categories: ["sideScheme"] } },
      amount: { kind: "const", value: 5 },
    },
  ],
});
const THWART_CARD = stubEvent({ id: "thwart", cost: 0, abilities: [THWART.ref] });
const deps: EngineDeps = depsOf(FOLLOWED_INTERRUPT, LATE_RESPONSE, THWART);

function start(): { state: GameState; scheme: string } {
  const base = gameAtFirstTurn({
    cards: [FOLLOWED as never, SCHEME, THWART_CARD],
    deps,
    encounter: [SCHEME.id],
    deck: [FOLLOWED.id, THWART_CARD.id],
  });
  const placed = encounterCardInVillainArea(base, SCHEME.id, 1);
  const given = giveCard(placed.state, P1, FOLLOWED.id);
  const { session } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: placed.id },
  ]);
  return { state: session.state, scheme: placed.id };
}

describe("§3.37 interrupts to a side scheme's defeat", () => {
  it("an attachment's 'when attached scheme is defeated' fires while the scheme is still in play", () => {
    const { state } = start();
    const { state: after, session } = playFree(state, deps, THWART_CARD.id);
    const identity = mustInstance(after, mustPlayer(after, P1).identity.instanceId);
    expect(identity.counters["interrupted"]).toBe(1);
    expect(identity.counters["schemeStillInPlay"]).toBe(1);
    expect(identity.counters["responded"] ?? 0).toBe(0);
    expect(after.villainArea.some((id) => after.instances[id]?.cardId === SCHEME.id)).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
