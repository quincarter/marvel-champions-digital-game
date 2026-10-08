/**
 * `InPlayCostPick.bindHosts` (docs/phase7-wave8.md §3.72): a cost that discards an attachment names its host for the
 * effects. Synthetic cards shaped like "Discard a tag from an enemy → deal 2 damage to that enemy."
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost is paid before the ability's effects resolve, so the picked card is off its
 * host by then and the host is read as the cost is planned; "Attach To" (p. 8).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const ENEMY = { kind: "each", query: { categories: ["enemy"] } } as const;
// "Discard a tag from an enemy → deal 2 damage to that enemy."
const DROP = stubAbility("drop.action", {
  trigger: { kind: "action" },
  cost: {
    discardCards: {
      slot: "discarded",
      query: { categories: ["upgrade"], name: "tag", host: ENEMY },
      min: 1,
      max: 1,
      bindHosts: "host",
    },
  },
  effects: [{ kind: "dealDamage", target: { kind: "slot", slot: "host" }, amount: { kind: "const", value: 2 } }],
});
const DROP_CARD = stubEvent({ id: "drop", cost: 0, abilities: [DROP.ref] });
const TAG = stubUpgrade({ id: "tag", cost: 0 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 5 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 5 });

const deps: EngineDeps = depsOf(DROP);

/** A copy of the tag attached to `host`, controlled by P1 (surgery). */
function tagOn(state: GameState, host: InstanceId, exclude: readonly InstanceId[] = []) {
  const given = giveCard(state, P1, TAG.id, exclude);
  const id = given.id;
  return {
    id,
    state: {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
      instances: {
        ...given.state.instances,
        [id]: { ...mustInstance(given.state, id), attachedTo: host, controllerId: P1, faceup: true },
        [host]: {
          ...mustInstance(given.state, host),
          attachments: [...mustInstance(given.state, host).attachments, id],
        },
      },
    } as GameState,
  };
}

function start(tagsInPlay: 0 | 1 | 2 | 3) {
  const state = gameAtFirstTurn({
    cards: [DROP_CARD, TAG, THUG, GOON],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 28), THUG.id, GOON.id],
    deck: [DROP_CARD.id, ...copiesOf(TAG.id, 3)],
  });
  const thug = minionEngagedWith(state, THUG.id);
  const goon = minionEngagedWith(thug.state, GOON.id);
  let current = goon.state;
  const tags: InstanceId[] = [];
  // The first tag on the thug, the second on the goon, the third loose in the play area (attached to nothing).
  const hosts = [thug.id, goon.id];
  for (let n = 0; n < Math.min(tagsInPlay, 2); n++) {
    const next = tagOn(current, hosts[n]!, tags);
    current = next.state;
    tags.push(next.id);
  }
  if (tagsInPlay === 3) {
    const loose = giveCard(current, P1, TAG.id, tags);
    current = {
      ...loose.state,
      players: loose.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== loose.id), playArea: [...p.playArea, loose.id] }
          : p,
      ),
      instances: {
        ...loose.state.instances,
        [loose.id]: { ...mustInstance(loose.state, loose.id), controllerId: P1, faceup: true },
      },
    };
    tags.push(loose.id);
  }
  const drop = giveCard(current, P1, DROP_CARD.id);
  return { state: drop.state, drop: drop.id, thug: thug.id, goon: goon.id, tags };
}
const play = (card: InstanceId, costChoices?: CostChoices): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});
const damage = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;

describe("a discard cost binds the hosts of its picks", () => {
  it("the enemy the discarded copy was on takes the damage, and the copy is in the discard pile", () => {
    const table = start(2);
    const { session } = driveSession(startSession(table.state), deps, [
      play(table.drop, { discarded: [table.tags[1]!] }),
    ]);
    const after = session.state;
    expect(damage(after, table.goon)).toBe(2);
    expect(damage(after, table.thug)).toBe(0);
    expect(mustPlayer(after, P1).discard).toContain(table.tags[1]);
    expect(mustInstance(after, table.tags[0]!).attachedTo).toBe(table.thug);
  });

  it("the other copy names the other enemy", () => {
    const table = start(2);
    const { session } = driveSession(startSession(table.state), deps, [
      play(table.drop, { discarded: [table.tags[0]!] }),
    ]);
    expect(damage(session.state, table.thug)).toBe(2);
    expect(damage(session.state, table.goon)).toBe(0);
  });

  it("one candidate: the pick is forced and its host is bound without the command naming it", () => {
    const table = start(1);
    const { session } = driveSession(startSession(table.state), deps, [play(table.drop)]);
    expect(damage(session.state, table.thug)).toBe(2);
  });

  it("'from an enemy': a copy attached to nothing cannot pay, and with no copy on an enemy the card cannot be played", () => {
    const table = start(3);
    expect(applyCommand(table.state, play(table.drop, { discarded: [table.tags[2]!] }), deps).ok).toBe(false);
    const none = start(0);
    expect(applyCommand(none.state, play(none.drop), deps).ok).toBe(false);
  });
});
