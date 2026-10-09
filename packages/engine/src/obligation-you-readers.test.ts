/**
 * An obligation's "you", reader by reader. No player controls an obligation (RRG 1.8 "Ownership and Control", p. 31),
 * but RRG 1.8 "Obligation" (p. 30): "Abilities on obligations that use the words 'you' or 'your' apply only to the
 * player whose play area the obligation is in." Every reader below resolves that player through `uncontrolledYouOf`
 * (the constant readers by way of `speakerOf` / `constantYouOf`).
 *
 * Two players throughout, the obligation in P2's play area, so a wrong "you" shows as nobody or as P1 (the first
 * player). Synthetic cards; one test per reader, then the same text on cards that are not obligations.
 *
 * The crisis icon is the one reader that does not follow the obligation's "you": an obligation is an encounter card, and
 * "Abilities on encounter cards are not affected by the crisis icon" (RRG 1.8 "Crisis Icon", p. 14; owner decision
 * Q66 = B, docs/phase7-wave6-handoff.md).
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { countsAsExtras, traitsOf, uncontrolledYouOf } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEnvironment,
  stubMinion,
  stubObligation,
  stubSideScheme,
  stubUpgrade,
} from "./testing/fixtures.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const MARKED = trait("Marked");
const YOU = { kind: "controller" } as const;
const YOUR_ALLIES: TargetQuery = { categories: ["ally"], controller: "you" };
const DRAW_1 = { kind: "draw", player: YOU, amount: n(1) } as const;
const EACH_MINION = { kind: "each", query: { categories: ["minion"] } } as const;

/** "Each ally you control is considered a support." */
const TAGGED = stubAbility(
  "tagged.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "countsAs", target: YOUR_ALLIES, categories: ["support"] }] },
    effects: [],
  }),
);
/** "Each ally you control gains the [Marked] trait." */
const BRANDED = stubAbility(
  "branded.constant",
  def({ trigger: { kind: "constant", traitGrants: [{ trait: MARKED, target: YOUR_ALLIES }] }, effects: [] }),
);
/** "Each ally you control gains guard." */
const WATCHED = stubAbility(
  "watched.constant",
  def({
    trigger: { kind: "constant", keywordGrants: [{ keyword: { name: "guard" }, target: YOUR_ALLIES }] },
    effects: [],
  }),
);
/** "When you control an ally, draw 1 card." */
const VIGIL = stubAbility(
  "vigil.check",
  def({ trigger: { kind: "stateCheck", when: { kind: "exists", query: YOUR_ALLIES } }, effects: [DRAW_1] }),
);
/** "Action: Draw 1 card. Only you may trigger this ability." */
const PLEA = stubAbility("plea.action", def({ trigger: { kind: "action", triggerableBy: YOU }, effects: [DRAW_1] }));
/** "Action: Deal 5 damage to each minion." */
const GRUDGE = stubAbility(
  "grudge.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "dealDamage", target: EACH_MINION, amount: n(5) }] }),
);
/** "Forced Response: After the villain takes damage, deal 5 damage to each minion." */
const SPITE = stubAbility(
  "spite.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
    effects: [{ kind: "dealDamage", target: EACH_MINION, amount: n(5) }],
  }),
);
/** "Action: Remove 3 threat from the main scheme." */
const LEVER = stubAbility(
  "lever.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(3) }],
  }),
);
/** An environment: "Forced Response: After a minion is defeated, the player who defeated it draws 1 card." */
const TALLY = stubAbility(
  "tally.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["minion"] } } },
    effects: [{ kind: "draw", player: { kind: "defeatingPlayer" }, amount: n(1) }],
  }),
);
/** An environment: "P2 cannot remove threat from the main scheme." */
const WARD = stubAbility(
  "ward.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        { kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] }, player: { kind: "id", playerId: P2 } },
      ],
    },
    effects: [],
  }),
);
/** A player upgrade with "Action: Draw 1 card." (a command for the flow to run under). */
const PING = stubAbility("ping.action", def({ trigger: { kind: "action" }, effects: [DRAW_1] }));

const SPEAKING = [TAGGED, BRANDED, WATCHED, VIGIL, PLEA, GRUDGE, SPITE, LEVER] as const;
const speakingRefs = SPEAKING.map((ability) => ability.ref);

/** The same text on an obligation, a player upgrade, an environment and a minion. */
const DUTY = stubObligation({ id: "duty", abilities: speakingRefs });
const GEAR = stubUpgrade({ id: "gear", cost: 0, abilities: speakingRefs });
const WEATHER = stubEnvironment({ id: "weather", abilities: speakingRefs });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 30, abilities: [SPITE.ref] });

const BOARD = stubEnvironment({ id: "board", abilities: [TALLY.ref] });
const SEAL = stubEnvironment({ id: "seal", abilities: [WARD.ref] });
const SIEGE = stubSideScheme({ id: "siege", startingThreat: 10, icons: ["crisis"] });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });
const FRIEND = stubAlly({ id: "friend", cost: 0, atk: 1, thw: 1, hp: 3 });
const RADIO = stubUpgrade({ id: "radio", cost: 0, abilities: [PING.ref] });

const deps: EngineDeps = depsOf(...SPEAKING, TALLY, WARD, PING);

/** Two players in hero form, the main scheme at 8 threat, and the scoreboard environment in the villain's area. */
function start(): GameState {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [DUTY, GEAR, WEATHER, BRUTE, BOARD, SEAL, SIEGE, GOON, FRIEND, RADIO],
    deps,
    deck: [GEAR.id, FRIEND.id, RADIO.id],
    encounter: [DUTY.id, WEATHER.id, BRUTE.id, BOARD.id, SEAL.id, SIEGE.id, GOON.id, GOON.id],
  });
  const main = base.mainScheme.instanceId;
  return encounterCardInVillainArea(
    {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
      instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 8 } },
    },
    BOARD.id,
  ).state;
}

/** Surgery: an obligation in `player`'s play area, controlled by no one. */
function oblige(state: GameState, card: CardId, player: PlayerId): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, card);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      players: taken.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
      ),
    },
  };
}

const use = (player: PlayerId, card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
const run = (state: GameState, ...commands: readonly Command[]) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events };
};
const asActive = (state: GameState, player: PlayerId) =>
  player === P1 ? state : run(state, { type: "endTurn", playerId: P1 }).state;
const hands = (state: GameState) => [mustPlayer(state, P1).hand.length, mustPlayer(state, P2).hand.length] as const;
/** How many cards each player drew between two states. */
const drawn = (before: GameState, after: GameState) => {
  const [a1, a2] = hands(after);
  const [b1, b2] = hands(before);
  return [a1 - b1, a2 - b2] as const;
};
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const blocks = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemovalBlocked" ? [e.reason] : []));
const inPlay = (state: GameState, id: InstanceId) => state.players.some((p) => p.playArea.includes(id));

/** Each player's ally in play, then the speaking card where `place` puts it. */
function withAllies(place: (state: GameState) => { state: GameState; id: InstanceId }) {
  const one = playerCardIntoPlay(start(), FRIEND.id, P1);
  const two = playerCardIntoPlay(one.state, FRIEND.id, P2);
  const placed = place(two.state);
  return { state: placed.state, source: placed.id, ally: { p1: one.id, p2: two.id } };
}
const constantsOn = (state: GameState, id: InstanceId) => ({
  countsAs: countsAsExtras(state, deps).get(id)?.categories ?? [],
  traits: traitsOf(state, id, deps),
  guard: hasKeyword(state, id, "guard", deps),
});
const NOTHING = { countsAs: [], traits: [], guard: false };

/** A P1 upgrade whose action is the command the state check is read under. */
function withRadio(state: GameState) {
  const radio = playerCardIntoPlay(state, RADIO.id, P1);
  return { state: radio.state, ping: use(P1, radio.id, PING) };
}

describe("an obligation's 'you' is the player whose play area holds it (RRG 1.8 p. 30)", () => {
  const obligation = (state: GameState) => oblige(state, DUTY.id, P2);

  it("nobody controls the obligation, and it speaks to P2", () => {
    const t = withAllies(obligation);
    expect(mustInstance(t.state, t.source).controllerId).toBeNull();
    expect(uncontrolledYouOf(t.state, t.source)).toBe(P2);
  });

  it("counts-as: 'each ally you control is considered a support' reaches P2's ally only", () => {
    const t = withAllies(obligation);
    expect(constantsOn(t.state, t.ally.p2).countsAs).toEqual(["support"]);
    expect(constantsOn(t.state, t.ally.p1).countsAs).toEqual([]);
  });

  it("trait grant: 'each ally you control gains the trait' reaches P2's ally only", () => {
    const t = withAllies(obligation);
    expect(constantsOn(t.state, t.ally.p2).traits).toEqual([MARKED]);
    expect(constantsOn(t.state, t.ally.p1).traits).toEqual([]);
  });

  it("keyword grant: 'each ally you control gains guard' reaches P2's ally only", () => {
    const t = withAllies(obligation);
    expect(constantsOn(t.state, t.ally.p2).guard).toBe(true);
    expect(constantsOn(t.state, t.ally.p1).guard).toBe(false);
  });

  it("state check: 'when you control an ally' turns true with P2's ally, and P2 resolves it", () => {
    const { state: base, ping } = withRadio(oblige(start(), DUTY.id, P2).state);
    const seen = run(base, ping).state;
    const allied = playerCardIntoPlay(seen, FRIEND.id, P2).state;
    // P1 draws for the ping; P2 draws for the obligation's check, although P1 is the first player.
    expect(drawn(allied, run(allied, ping).state)).toEqual([1, 1]);
  });

  it("state check: P1's ally does not make an obligation in P2's play area true", () => {
    const { state: base, ping } = withRadio(oblige(start(), DUTY.id, P2).state);
    const seen = run(base, ping).state;
    const allied = playerCardIntoPlay(seen, FRIEND.id, P1).state;
    expect(drawn(allied, run(allied, ping).state)).toEqual([1, 0]);
  });

  it("who may trigger: 'only you may trigger this ability' names P2, and not P1", () => {
    const { state: base, id } = oblige(start(), DUTY.id, P2);
    expect(applyCommand(base, use(P1, id, PLEA), deps).ok).toBe(false);
    const state = asActive(base, P2);
    expect(drawn(state, run(state, use(P2, id, PLEA)).state)).toEqual([0, 1]);
  });

  it("defeated by: a minion defeated by the obligation's action is defeated by P2", () => {
    const obliged = oblige(start(), DUTY.id, P2);
    const goon = minionEngagedWith(obliged.state, GOON.id, P1);
    const state = asActive(goon.state, P2);
    const after = run(state, use(P2, obliged.id, GRUDGE)).state;
    expect(inPlay(after, goon.id)).toBe(false);
    expect(drawn(state, after)).toEqual([0, 1]);
  });

  it("defeated by: a minion defeated by the obligation's forced ability is defeated by P2, whoever set it off", () => {
    const obliged = oblige(start(), DUTY.id, P2);
    const goon = minionEngagedWith(obliged.state, GOON.id, P1);
    const after = run(goon.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: mustPlayer(goon.state, P1).identity.instanceId,
      targetInstanceId: activeVillain(goon.state).instanceId,
    }).state;
    expect(inPlay(after, goon.id)).toBe(false);
    expect(drawn(goon.state, after)).toEqual([0, 1]);
  });

  it("crisis: the obligation is an encounter card, so a crisis icon does not stop P2 using its action (RRG p. 14)", () => {
    const obliged = oblige(start(), DUTY.id, P2);
    const state = asActive(encounterCardInVillainArea(obliged.state, SIEGE.id, 10).state, P2);
    const after = run(state, use(P2, obliged.id, LEVER));
    expect(mainThreat(after.state)).toBe(5);
    expect(blocks(after.events)).toEqual([]);
  });

  it("a rule that P2 cannot remove threat from the main scheme still stops P2 using the obligation's action", () => {
    const obliged = oblige(start(), DUTY.id, P2);
    const state = asActive(encounterCardInVillainArea(obliged.state, SEAL.id).state, P2);
    // With no threat it could remove, the action has no valid target and cannot be used.
    expect(applyCommand(state, use(P2, obliged.id, LEVER), deps).ok).toBe(false);
    expect(mainThreat(run(asActive(obliged.state, P2), use(P2, obliged.id, LEVER)).state)).toBe(5);
  });
});

describe("the same text on a card that is not an obligation reads as before", () => {
  it("a player card: its controller's ally only, for counts-as, the trait grant and the keyword grant", () => {
    const t = withAllies((state) => playerCardIntoPlay(state, GEAR.id, P1));
    expect(constantsOn(t.state, t.ally.p1)).toEqual({ countsAs: ["support"], traits: [MARKED], guard: true });
    expect(constantsOn(t.state, t.ally.p2)).toEqual(NOTHING);
  });

  it("a player card: its controller resolves the state check, may trigger the action, and defeats the minion", () => {
    const gear = playerCardIntoPlay(start(), GEAR.id, P2);
    const { state: base, ping } = withRadio(gear.state);
    const seen = run(base, ping).state;
    const allied = playerCardIntoPlay(seen, FRIEND.id, P2).state;
    expect(drawn(allied, run(allied, ping).state)).toEqual([1, 1]);

    expect(applyCommand(gear.state, use(P1, gear.id, PLEA), deps).ok).toBe(false);
    const goon = minionEngagedWith(gear.state, GOON.id, P1);
    const state = asActive(goon.state, P2);
    expect(drawn(state, run(state, use(P2, gear.id, PLEA)).state)).toEqual([0, 1]);
    expect(drawn(state, run(state, use(P2, gear.id, GRUDGE)).state)).toEqual([0, 1]);
  });

  it("a player card's removal is still stopped by a crisis icon", () => {
    const gear = playerCardIntoPlay(start(), GEAR.id, P1);
    const state = encounterCardInVillainArea(gear.state, SIEGE.id, 10).state;
    expect(applyCommand(state, use(P1, gear.id, LEVER), deps).ok).toBe(false);
    expect(mainThreat(run(gear.state, use(P1, gear.id, LEVER)).state)).toBe(5);
  });

  it("an environment in the villain's area speaks to no one: no ally is reached, and its state check never turns true", () => {
    const t = withAllies((state) => encounterCardInVillainArea(state, WEATHER.id));
    expect(uncontrolledYouOf(t.state, t.source)).toBeNull();
    expect(constantsOn(t.state, t.ally.p1)).toEqual(NOTHING);
    expect(constantsOn(t.state, t.ally.p2)).toEqual(NOTHING);

    const { state: base, ping } = withRadio(encounterCardInVillainArea(start(), WEATHER.id).state);
    const seen = run(base, ping).state;
    const allied = playerCardIntoPlay(playerCardIntoPlay(seen, FRIEND.id, P1).state, FRIEND.id, P2).state;
    expect(drawn(allied, run(allied, ping).state)).toEqual([1, 0]);
  });

  it("an environment in the villain's area: 'only you may trigger' names nobody, and its damage has no defeating player", () => {
    const weather = encounterCardInVillainArea(start(), WEATHER.id);
    const goon = minionEngagedWith(weather.state, GOON.id, P1);
    expect(applyCommand(goon.state, use(P1, weather.id, PLEA), deps).ok).toBe(false);
    const after = run(goon.state, use(P1, weather.id, GRUDGE)).state;
    expect(inPlay(after, goon.id)).toBe(false);
    expect(drawn(goon.state, after)).toEqual([0, 0]);
  });

  it("a minion engaged with a player: a minion its forced ability defeats has no defeating player", () => {
    const brute = minionEngagedWith(start(), BRUTE.id, P2);
    const goon = minionEngagedWith(brute.state, GOON.id, P1);
    const after = run(goon.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: mustPlayer(goon.state, P1).identity.instanceId,
      targetInstanceId: activeVillain(goon.state).instanceId,
    }).state;
    expect(inPlay(after, goon.id)).toBe(false);
    expect(inPlay(after, brute.id)).toBe(true);
    expect(drawn(goon.state, after)).toEqual([0, 0]);
  });
});
