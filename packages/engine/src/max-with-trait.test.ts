/**
 * docs/phase7-wave6.md §3.28: a maximum counted over a trait rather than copies by title (`PlayRestrictions.maxWithTrait`).
 * Synthetic cards shaped like Danger Room Training / Mission Training / Protective Training / Attack Training (33015,
 * 34016, 32013, 32043: "Attach to an X-MEN ally. Max 1 TRAINING upgrade per ally.") and Uncanny X-Men / Flight
 * Squadron (36018, 53020: "Max 1 TEAM card per player.").
 *
 * Source: RRG 1.8 "Max, Maximum" (p. 28): "'Max 1 per player' is player specific, and restricts the number of copies of
 * that card that each player may control in play at a given time"; "'Max 1 per [game element]' restricts the number of
 * copies of that card that can be attached to each indicated game element."
 */

import { trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const deps = depsOf();
const TRAINING = trait("TRAINING");
const TEAM = trait("TEAM");
const X_MEN = trait("X-MEN");

const trainingUpgrade = (id: string): AnyCard => ({
  ...stubUpgrade({ id, cost: 0, traits: [TRAINING] }),
  attachesTo: { kind: "qualified", category: "ally", trait: X_MEN },
  playRestrictions: { maxWithTrait: { trait: TRAINING, per: "host", max: 1 } },
});
/** Two different titles: the limit is by trait, so title-based `maxPerHost` would not catch this. */
const DANGER_ROOM = trainingUpgrade("danger-room");
const MISSION = trainingUpgrade("mission");
/** An X-MEN ally upgrade without the trait: never counted. */
const BADGE: AnyCard = {
  ...stubUpgrade({ id: "badge", cost: 0 }),
  attachesTo: { kind: "qualified", category: "ally", trait: X_MEN },
};
const COLOSSUS = stubAlly({ id: "colossus", cost: 0, atk: 2, thw: 1, hp: 4, traits: [X_MEN] });
const KITTY = stubAlly({ id: "kitty", cost: 0, atk: 1, thw: 2, hp: 3, traits: [X_MEN] });

const teamSupport = (id: string, anyPlayerControl = false): AnyCard => ({
  ...stubSupport({ id, cost: 0, traits: [TEAM] }),
  playRestrictions: {
    maxWithTrait: { trait: TEAM, per: "player", max: 1 },
    ...(anyPlayerControl ? { anyPlayerControl } : {}),
  },
});
const UNCANNY = teamSupport("uncanny", true);
const SQUADRON = teamSupport("squadron");
/** A TEAM character: the per-player count is over every card that player controls, characters included. */
const TEAM_ALLY = stubAlly({ id: "team-ally", cost: 0, atk: 1, thw: 1, hp: 2, traits: [TEAM] });

const CARDS = [DANGER_ROOM, MISSION, BADGE, COLOSSUS, KITTY, UNCANNY, SQUADRON, TEAM_ALLY];
const copies = (id: CardId, n = 2): readonly CardId[] => Array.from({ length: n }, () => id);

function start(players = 1): GameState {
  return newGame({
    players,
    deps,
    extraCards: CARDS,
    deck: [...CARDS.flatMap((card) => copies(card.id)), ...copies(RESOURCE.id, 12)],
  });
}

const play = (id: InstanceId, extra: Partial<Extract<Command, { type: "playCard" }>> = {}): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...extra,
});
const onto = (id: InstanceId, host: InstanceId) => play(id, { attachToInstanceId: host });
const refusal = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("expected a refusal");
  return { code: result.error.code, message: result.error.message };
};
const playOf = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  const isIt = (ref: { kind: string; instanceId?: InstanceId }) => ref.kind === "playCard" && ref.instanceId === id;
  return {
    legal: actions.legal.find((entry) => isIt(entry.action)),
    illegal: actions.illegal.find((entry) => isIt(entry.action)),
  };
};

describe("Max 1 TRAINING upgrade per ally (maxWithTrait, per host)", () => {
  function allies() {
    const given = giveCards(start(), p1, "colossus", "kitty", "danger-room", "mission", "badge");
    const [colossus, kitty, dangerRoom, mission, badge] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    return {
      state: runWith(deps, given.state, play(colossus), play(kitty)),
      colossus,
      kitty,
      dangerRoom,
      mission,
      badge,
    };
  }

  it("refuses a second TRAINING upgrade on the same ally, with its message; another ally is fine", () => {
    const { state, colossus, kitty, dangerRoom, mission } = allies();
    const trained = runWith(deps, state, onto(dangerRoom, colossus));
    expect(refusal(trained, onto(mission, colossus))).toEqual({
      code: "no_valid_target",
      message: "max 1 TRAINING upgrade per host",
    });
    const both = runWith(deps, trained, onto(mission, kitty));
    expect(mustInstance(both, colossus).attachments).toEqual([dangerRoom]);
    expect(mustInstance(both, kitty).attachments).toEqual([mission]);
  });

  it("an attachment without the trait neither counts nor is limited", () => {
    const { state, colossus, dangerRoom, badge } = allies();
    const badged = runWith(deps, state, onto(badge, colossus), onto(dangerRoom, colossus));
    expect(mustInstance(badged, colossus).attachments).toEqual([badge, dangerRoom]);
  });

  it("legalActions offers only the open ally, lists the full one as blocked, and refuses the play once none is open", () => {
    const { state, colossus, kitty, dangerRoom, mission } = allies();
    const trained = runWith(deps, state, onto(dangerRoom, colossus));
    const offered = playOf(trained, mission);
    expect(offered.legal?.targets).toEqual([kitty]);
    expect(offered.legal?.blockedTargets).toEqual([
      { instanceId: colossus, reason: "no_valid_target", message: "max 1 TRAINING upgrade per host" },
    ]);

    const withoutKitty = giveCards(start(), p1, "colossus", "danger-room", "mission");
    const [solo, first, second] = withoutKitty.ids as [InstanceId, InstanceId, InstanceId];
    const full = runWith(deps, withoutKitty.state, play(solo), onto(first, solo));
    const none = playOf(full, second);
    expect(none.legal).toBeUndefined();
    expect(none.illegal?.message).toBe("max 1 TRAINING upgrade per host");
  });

  it("the game log replays to the same state", () => {
    const given = giveCards(start(), p1, "colossus", "kitty", "danger-room", "mission");
    const [colossus, kitty, dangerRoom, mission] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const driven = driveSession(startSession(given.state), deps, [
      play(colossus),
      play(kitty),
      onto(dangerRoom, colossus),
      onto(mission, kitty),
    ]);
    const replayed = replay(driven.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(driven.session.state);
    expect(mustInstance(replayed.state, kitty).attachments).toEqual([mission]);
  });
});

describe("Max 1 TEAM card per player (maxWithTrait, per player)", () => {
  it("counts every card the player controls with the trait, of any title, characters included", () => {
    const given = giveCards(start(), p1, "uncanny", "squadron", "team-ally");
    const [uncanny, squadron, teamAlly] = given.ids as [InstanceId, InstanceId, InstanceId];
    const withSquadron = runWith(deps, given.state, play(squadron));
    expect(refusal(withSquadron, play(uncanny))).toEqual({
      code: "no_valid_target",
      message: "max 1 TEAM card per player",
    });
    const withAlly = runWith(deps, given.state, play(teamAlly));
    expect(refusal(withAlly, play(squadron)).message).toBe("max 1 TEAM card per player");
  });

  it("is counted under the player who would control it ('Play under any player's control')", () => {
    const given = giveCards(start(2), p1, "squadron", "uncanny");
    const [squadron, uncanny] = given.ids as [InstanceId, InstanceId];
    const withSquadron = runWith(deps, given.state, play(squadron));
    expect(refusal(withSquadron, play(uncanny)).message).toBe("max 1 TEAM card per player");
    const shared = runWith(deps, withSquadron, play(uncanny, { controllerId: p2 }));
    expect(mustInstance(shared, uncanny).controllerId).toBe(p2);
  });
});
