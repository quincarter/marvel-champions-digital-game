/**
 * docs/phase7-wave11-hero-packs.md H3.11 (HT6): "Attach to a card." (`AttachmentHost anyCard`, Mitigated Threat
 * 61040). Any card in play other than the attaching card, player or encounter side, any controller, whatever its type.
 * An out-of-play facedown attachment is never a host. Controls: a typed host (`sideScheme`) still offers only its type,
 * and an upgrade with this host plays onto the villain.
 *
 * Sources: RRG 1.8 "Attach To" (p. 8), "In Play and Out of Play" (p. 23), "Upgrade" (p. 46).
 */

import type { UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { attachHostCandidates, attachmentHostCandidates } from "./attachment-hosts.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mainSchemeFor, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubSideScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const deps = depsOf();
const ANY: UpgradeCard = { ...stubUpgrade({ id: "any-card-upgrade", cost: 0 }), attachesTo: { kind: "anyCard" } };
const GEAR = stubSupport({ id: "gear", cost: 0 });
const SIDE = stubSideScheme({ id: "side", startingThreat: 2, boostIcons: 0 });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 3, boostIcons: 0 });

/** Two players: a side scheme, P1's gear and the upgrade, P2's gear and a minion engaged with P2. */
function board() {
  const start = gameAtFirstTurn({
    cards: [ANY, GEAR, SIDE, GOON],
    deps,
    players: 2,
    encounter: [SIDE.id, GOON.id],
    deck: [ANY.id, ANY.id, GEAR.id],
  });
  const side = encounterCardInVillainArea(start, SIDE.id, 2);
  const gear = playerCardIntoPlay(side.state, GEAR.id);
  const theirGear = playerCardIntoPlay(gear.state, GEAR.id, P2);
  const goon = minionEngagedWith(theirGear.state, GOON.id, P2);
  const any = playerCardIntoPlay(goon.state, ANY.id);
  return { state: any.state, side: side.id, gear: gear.id, theirGear: theirGear.id, goon: goon.id, self: any.id };
}

const context = (self: InstanceId | null) => ({
  selfInstanceId: self,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});

/** `id` attached facedown (out of play) to `host`, test surgery. */
function attachFacedown(state: GameState, id: InstanceId, host: InstanceId): GameState {
  const seat = mustPlayer(state, P1);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: seat.playArea.filter((x) => x !== id) } : p,
    ),
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host, faceup: false, facedownAs: { kind: "blank", traits: [] } },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
    },
  };
}

describe("H3.11 'Attach to a card.'", () => {
  it("offers every card in play of either side and every type, but never the attaching card", () => {
    const { state, side, gear, self } = board();
    const hosts = attachmentHostCandidates(state, { kind: "anyCard" }, context(self));
    expect(hosts).toContain(mustPlayer(state, P1).identity.instanceId);
    expect(hosts).toContain(state.activeVillainId);
    expect(hosts).toContain(mainSchemeFor(state, null)!.instanceId);
    expect(hosts).toContain(side);
    expect(hosts).toContain(gear);
    expect(hosts).not.toContain(self);
  });

  it("offers another player's card and a minion engaged with them", () => {
    const { state, theirGear, goon, self } = board();
    const hosts = attachmentHostCandidates(state, { kind: "anyCard" }, context(self));
    expect(hosts).toContain(theirGear);
    expect(hosts).toContain(goon);
    expect(hosts).toContain(mustPlayer(state, P2).identity.instanceId);
  });

  it("never offers a facedown attachment, which is out of play", () => {
    const { state, gear, self } = board();
    const facedown = attachFacedown(state, gear, state.activeVillainId);
    const hosts = attachmentHostCandidates(facedown, { kind: "anyCard" }, context(self));
    expect(hosts).not.toContain(gear);
    expect(hosts).toContain(state.activeVillainId);
  });

  it("control: a typed host still offers only its own type", () => {
    const { state, side, self } = board();
    expect(attachmentHostCandidates(state, { kind: "sideScheme" }, context(self))).toEqual([side]);
  });

  it("an upgrade with this host plays onto the villain", () => {
    const { state } = board();
    const villain = state.activeVillainId;
    const given = giveCard(state, P1, ANY.id);
    expect(attachHostCandidates(given.state, deps, given.id, P1)).toContain(villain);
    const { session } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: villain },
    ]);
    expect(mustInstance(session.state, given.id).attachedTo).toBe(villain);
    expect(mustInstance(session.state, villain).attachments).toContain(given.id);
  });
});
