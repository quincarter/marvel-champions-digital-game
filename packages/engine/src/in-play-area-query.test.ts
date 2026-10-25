/**
 * `TargetQuery.inPlayAreaOf` and attachments (#411, post-merge review of #413): "if this card is in your play area" on
 * an upgrade with no "attach to" text (Stakeout `jj` 61014), which a play puts on its player's identity. RRG 1.8
 * "Player's Play Area": upgrades are placed in a player's play area as they enter play, and an attachment on a card in
 * the villain's play area is not in a player's.
 */
import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { explainQuery } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const ALARM = stubSideScheme({ id: "alarm", startingThreat: 3 });
const STAKE = stubUpgrade({ id: "stake", cost: 0 });
const HELPER = stubAlly({ id: "helper", cost: 0, atk: 1, thw: 1, hp: 2 });

const deps = depsOf();
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const IN_YOUR_AREA: TargetQuery = { inPlayAreaOf: { kind: "controller" } };

const idOf = (state: GameState, name: string): InstanceId =>
  Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;

/** Surgery: `name` out of P1's deck, faceup; attached to `host`, or loose in P1's play area when `host` is null. */
function place(state: GameState, name: string, host: InstanceId | null): GameState {
  const id = idOf(state, name);
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((i) => i !== id),
      playArea: host === null ? [...p.playArea, id] : p.playArea,
    })),
    instances: {
      ...state.instances,
      [id]: { ...state.instances[id]!, controllerId: P1, faceup: true, attachedTo: host },
      ...(host
        ? { [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] } }
        : {}),
    },
  };
}

function start() {
  const base = gameAtFirstTurn({
    cards: [ALARM, STAKE, HELPER],
    deps,
    encounter: [ALARM.id],
    deck: [STAKE.id, HELPER.id],
  });
  const alarm = encounterCardInVillainArea(base, ALARM.id, 3);
  return { state: alarm.state, alarm: alarm.id, identity: alarm.state.players[0]!.identity.instanceId };
}
const inYourArea = (state: GameState, id: InstanceId) => explainQuery(state, id, IN_YOUR_AREA, context) === null;

describe("`inPlayAreaOf` reads attachments by their host's area", () => {
  it("a card loose in the play area is in it", () => {
    const g = start();
    const state = place(g.state, "stake", null);
    expect(inYourArea(state, idOf(state, "stake"))).toBe(true);
  });

  it("an upgrade attached to the identity is in that player's area; the identity itself is not (an engine reading)", () => {
    const g = start();
    const state = place(g.state, "stake", g.identity);
    expect(inYourArea(state, idOf(state, "stake"))).toBe(true);
    expect(explainQuery(state, g.identity, IN_YOUR_AREA, context)).toBe("notInPlayArea");
  });

  it("an attachment on an ally in the play area is in it", () => {
    const g = start();
    const withAlly = place(g.state, "helper", null);
    const state = place(withAlly, "stake", idOf(withAlly, "helper"));
    expect(inYourArea(state, idOf(state, "stake"))).toBe(true);
  });

  it("an attachment on a side scheme in the villain's area is not", () => {
    const g = start();
    const state = place(g.state, "stake", g.alarm);
    expect(explainQuery(state, idOf(state, "stake"), IN_YOUR_AREA, context)).toBe("notInPlayArea");
  });
});

// PR #416 review: the area is the host's, whoever controls the attachment, and it follows a host that is itself attached.
describe("`inPlayAreaOf` follows the host across players", () => {
  const PIN = stubUpgrade({ id: "pin", cost: 0 });
  const inAreaOf = (state: GameState, id: InstanceId, playerId: typeof P1) =>
    explainQuery(state, id, { inPlayAreaOf: { kind: "id", playerId } }, context);

  it("a P1 attachment on P2's ally is in P2's area, not P1's; one attached to it too", () => {
    const base = gameAtFirstTurn({
      cards: [STAKE, HELPER, PIN],
      deps,
      deck: [STAKE.id, HELPER.id, PIN.id],
      players: 2,
    });
    const [p1, p2] = base.players as [GameState["players"][number], GameState["players"][number]];
    const first = (name: string) =>
      Object.values(base.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;
    const helper = first("helper");
    const stake = first("stake");
    const pin = first("pin");
    const moved = [helper, stake, pin];
    const state: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        deck: p.deck.filter((i) => !moved.includes(i)),
        hand: p.hand.filter((i) => !moved.includes(i)),
        playArea: p.playerId === p2.playerId ? [...p.playArea, helper] : p.playArea,
      })),
      instances: {
        ...base.instances,
        [helper]: { ...base.instances[helper]!, controllerId: p2.playerId, faceup: true, attachments: [stake] },
        [stake]: {
          ...base.instances[stake]!,
          controllerId: p1.playerId,
          faceup: true,
          attachedTo: helper,
          attachments: [pin],
        },
        [pin]: { ...base.instances[pin]!, controllerId: p1.playerId, faceup: true, attachedTo: stake },
      },
    };
    expect(inAreaOf(state, stake, p2.playerId)).toBeNull();
    expect(inAreaOf(state, stake, p1.playerId)).toBe("notInPlayArea");
    expect(inAreaOf(state, pin, p2.playerId)).toBeNull();
    expect(inAreaOf(state, pin, p1.playerId)).toBe("notInPlayArea");
  });
});
