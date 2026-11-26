/**
 * Regression (#1012 §4): when the main scheme deck advances, the new stage's starting threat goes on before its B side's
 * When Revealed resolves, and after its A side's.
 *
 * RRG 1.8 "Main Scheme" (p. 27), advance steps: "2. Resolve any 'When Revealed' ability on the 'A' side of the new top
 * card of the main scheme deck. 3. Flip the top card of the main scheme deck to its 'B' side, place threat on that card
 * equal to its starting threat value, and resolve any 'When Revealed' ability on that side of the card."
 *
 * Synthetic scheme: stage 1 never completes by itself; stage 2 starts with 3 threat, its A side's When Revealed counts
 * the threat on the scheme into `onA`, and its B side's When Revealed counts it into `onB` and then removes 2.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

/** One counter of `counterType` on the scheme per threat on it now. */
const countThreat = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "threat", of: self },
});
const A_SIDE = stubAbility("stage2a.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [countThreat("onA")],
});
const B_SIDE = stubAbility("stage2b.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [countThreat("onB"), { kind: "removeThreat", target: self, amount: { kind: "const", value: 2 } }],
});
const SCHEME = stubMainScheme({
  id: "order-scheme",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) },
    {
      startingThreat: flat(3),
      targetThreat: flat(99),
      acceleration: flat(0),
      aSideAbilities: [A_SIDE.ref],
      abilities: [B_SIDE.ref],
    },
  ],
});
const ADVANCE_ABILITY = stubAbility("advance-card.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "advanceMainScheme" }],
});
const ADVANCE = stubEvent({ id: "advance-card", cost: 0, abilities: [ADVANCE_ABILITY.ref] });
const deps: EngineDeps = depsOf(A_SIDE, B_SIDE, ADVANCE_ABILITY);

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 3,
      cards: [QUIET_VILLAIN, SCHEME, BLANK, ADVANCE, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: Array.from({ length: 6 }, () => ADVANCE.id as CardId),
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

describe("RRG 1.8 'Main Scheme' p. 27, advance step 3: the starting threat goes on before the B side's When Revealed", () => {
  it("the A side's When Revealed sees none of it, the B side's sees all of it and removes 2 of it", () => {
    const given = giveCard(game(), p1, ADVANCE.id);
    const run = runCommands(given.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);

    const { state, events } = run;
    expect(state.mainScheme.stageIndex).toBe(1);
    const scheme = mustInstance(state, state.mainScheme.instanceId);
    expect(scheme.counters.onA ?? 0).toBe(0); // step 2: before the flip
    expect(scheme.counters.onB).toBe(3); // step 3: after the starting threat
    expect(scheme.threat).toBe(1); // 3 placed, then 2 removed by the B side

    // The log shows the order: the starting threat's placement, then the B side's removal.
    const schemeId = state.mainScheme.instanceId;
    const order = events.flatMap((e) =>
      e.type === "threatPlaced" && e.schemeInstanceId === schemeId
        ? ["placed"]
        : e.type === "threatRemoved" && e.schemeInstanceId === schemeId
          ? ["removed"]
          : [],
    );
    expect(order).toEqual(["placed", "removed"]);
  });
});
