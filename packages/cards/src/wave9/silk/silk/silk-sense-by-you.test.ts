import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  use,
  payWith,
  play,
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import { SILK_DEPS, engageMinion, silkHeroGame } from "../testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Issue #817: "you" in Silk Sense (52001a, "After you defeat a minion or side scheme") is Silk's identity, not an ally
 * she controls (RRG 1.8 "You, Your", p. 49); an event she plays counts as the identity (FFG ruling January 24, 2025,
 * Change of Fortune). Core's Daredevil (01058) is the ally and Uppercut (01054) the event.
 */
const SENSE = "52001a.silk-sense";
const ROOM = "01063.interrogation-room-response";
const offered = (s: GameState, ref: string): boolean =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" && s.pendingChoice.options.some((o) => o.optionId.endsWith(ref));

/** A doomed Hydra Mercenary engaged with Silk, and Daredevil in her play area, ready, under her control (surgery). */
function withAllyAndMinion(): { readonly state: GameState; readonly ally: InstanceId; readonly minion: InstanceId } {
  const engaged = engageMinion(
    silkHeroGame({ swap: { "52008": "01058", "52009": "01054", "52010": "01063", "52011": "01056" } }),
    "01101",
  );
  const given = moveToHand(engaged.state, P1, "01058");
  const [ally] = given.ids as [InstanceId];
  const placed = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== ally), playArea: [...p.playArea, ally] } : p,
    ),
  };
  const ready = patchInstance(placed, ally, { controllerId: P1, faceup: true, exhausted: false });
  return { state: patchInstance(ready, engaged.id, { damage: 2 }), ally, minion: engaged.id };
}

const attackWith = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as const;

describe("Silk Sense and 'you defeat' (#817)", () => {
  it("is not offered when an ally Silk controls defeats the minion", () => {
    const { state, ally, minion } = withAllyAndMinion();
    const asked = settle(
      runWith(SILK_DEPS, state, attackWith(ally, minion)),
      firstLegal,
      (s) => offered(s, SENSE),
      SILK_DEPS,
    );
    expect(offered(asked, SENSE)).toBe(false);
    const { state: done } = driveEventsPicking(SILK_DEPS, state, firstLegal, attackWith(ally, minion));
    expect(inst(done, identityOf(done)).tucked).toEqual([]);
  });

  it("is offered when Silk's own basic attack defeats the minion", () => {
    const { state, minion } = withAllyAndMinion();
    const asked = settle(
      runWith(SILK_DEPS, state, attackWith(identityOf(state), minion)),
      firstLegal,
      (s) => offered(s, SENSE),
      SILK_DEPS,
    );
    expect(offered(asked, SENSE)).toBe(true);
  });

  it("is offered when an event Silk plays (Uppercut) defeats the minion", () => {
    const { state, minion } = withAllyAndMinion();
    const given = moveToHand(state, P1, "01054");
    const [event] = given.ids as [InstanceId];
    const pickMinion: Picker = (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === minion) ? [minion as string] : firstLegal(s);
    const played = runWith(SILK_DEPS, given.state, play(P1, event, payWith(given.state, P1, 3, [event])));
    const asked = settle(played, pickMinion, (s) => offered(s, SENSE), SILK_DEPS);
    expect(offered(asked, SENSE)).toBe(true);
  });

  it("Interrogation Room (01063, 'After you defeat a minion') is not offered for an ally's defeat either", () => {
    const { state, ally, minion } = withAllyAndMinion();
    const given = moveToHand(state, P1, "01063");
    const [room] = given.ids as [InstanceId];
    const withRoom = settle(
      runWith(
        SILK_DEPS,
        patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 3 }),
        play(P1, room, payWith(given.state, P1, 1, [room])),
      ),
      firstLegal,
      undefined,
      SILK_DEPS,
    );
    expect(withRoom.players[0]!.playArea).toContain(room);
    const viaAlly = settle(
      runWith(SILK_DEPS, withRoom, attackWith(ally, minion)),
      firstLegal,
      (s) => offered(s, ROOM),
      SILK_DEPS,
    );
    expect(offered(viaAlly, ROOM)).toBe(false);
    const viaSilk = settle(
      runWith(SILK_DEPS, withRoom, attackWith(identityOf(withRoom), minion)),
      firstLegal,
      (s) => offered(s, ROOM),
      SILK_DEPS,
    );
    expect(offered(viaSilk, ROOM)).toBe(true);
  });

  it("is not offered when a support she controls (Tac Team) deals the defeating damage", () => {
    const { state, minion } = withAllyAndMinion();
    const given = moveToHand(state, P1, "01056");
    const [team] = given.ids as [InstanceId];
    const staged = patchInstance(
      {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== team), playArea: [...p.playArea, team] } : p,
        ),
      },
      team,
      { controllerId: P1, faceup: true, counters: { attack: 3 } },
    );
    const pickMinion: Picker = (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === minion) ? [minion as string] : firstLegal(s);
    const run = runWith(SILK_DEPS, staged, use(P1, team, "01056.tac-team-action"));
    expect(inst(run, team).exhausted).toBe(true);
    const asked = settle(run, pickMinion, (s) => offered(s, SENSE), SILK_DEPS);
    expect(offered(asked, SENSE)).toBe(false);
    expect(inst(asked, minion).damage).toBe(0); // defeated: the damage reset on leaving play
  });

  it("is not offered when an ally's thwart clears a side scheme, but is for Silk's own", () => {
    const { state, ally } = withAllyAndMinion();
    const placed = encounterCardInVillainArea(state, "01107", 1);
    const thwart = (thwarter: InstanceId) =>
      ({ type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: placed.id }) as const;
    const viaAlly = settle(
      runWith(SILK_DEPS, placed.state, thwart(ally)),
      firstLegal,
      (s) => offered(s, SENSE),
      SILK_DEPS,
    );
    expect(placed.state.villainArea).toContain(placed.id);
    expect(viaAlly.villainArea).not.toContain(placed.id);
    expect(offered(viaAlly, SENSE)).toBe(false);
    const viaSilk = settle(
      runWith(SILK_DEPS, placed.state, thwart(identityOf(placed.state))),
      firstLegal,
      (s) => offered(s, SENSE),
      SILK_DEPS,
    );
    expect(offered(viaSilk, SENSE)).toBe(true);
  });
});
