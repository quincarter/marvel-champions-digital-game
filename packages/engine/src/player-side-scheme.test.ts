/**
 * docs/phase7-wave7.md §3.1: a player side scheme in play. Synthetic cards: a per-player mission with "When Defeated:
 * Deal 2 damage to the hero of the player who defeated this scheme" (the marker for who that is; Lay the Trap's and
 * Keep Them Busy's wording), a flat one printing a hazard and an amplify icon, a Victory 0 one, and encounter cards
 * that name side schemes: "place 1 threat on each side scheme" (Riptide's
 * shape), "place 1 threat on the main scheme for each side scheme in play".
 *
 * Sources: RRG 1.8 "Player Side Scheme" (p. 34): placed "next to the main scheme in the villain's play area", "enters
 * play with an amount of threat on it equal to its starting threat value", "Any rules or card effects that refer to
 * 'schemes' or 'side schemes' also refer to player side schemes"; "Player Turn" (p. 34): played from hand on your own
 * turn; "Player Elimination" (p. 34) step 4: "Place each card owned by the eliminated player in the eliminated
 * player's discard pile". "The player who defeated this scheme" when no player removed the last threat (§4.2 Q2) is
 * decided and not built yet: an `it.todo` below.
 */

import { flat, perPlayerOnly, type AnyCard, type PlayerSideSchemeCard, type ScalingValue } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { amplifyIconsInPlay } from "./modifiers.js";
import { mustInstance, mustPlayer } from "./query.js";
import { iconsInPlay, iconsOn } from "./rules.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEnvironment,
  stubEvent,
  stubSideScheme,
  stubSupport,
  stubTreachery,
} from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const eachSideScheme = { kind: "each", query: { categories: ["sideScheme"] } } as const;

/** A player side scheme: a 0-cost player card with a starting threat, built on the support stub's player card fields. */
function playerSideScheme(spec: {
  readonly id: string;
  readonly startingThreat: ScalingValue;
  readonly extra?: Partial<PlayerSideSchemeCard>;
}): PlayerSideSchemeCard {
  return {
    ...stubSupport({ id: spec.id, cost: 0 }),
    type: "player_side_scheme",
    startingThreat: spec.startingThreat,
    ...spec.extra,
  };
}

/** "When Defeated: Deal 2 damage to the hero of the player who defeated this scheme." */
const whenDefeatedMarks = (id: string) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "whenDefeated" },
      effects: [
        { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "defeatingPlayer" } }, amount: n(2) },
      ],
    }),
  );
const MISSION_DEFEATED = whenDefeatedMarks("mission.when-defeated");
/** "3 per player" starting threat (Call for Backup's shape), with the marker When Defeated. */
const MISSION = playerSideScheme({
  id: "mission",
  startingThreat: perPlayerOnly(3),
  extra: { abilities: [MISSION_DEFEATED.ref] },
});
/** A flat 5 starting threat (Technovirus Purge's shape), printing a hazard icon and an amplify icon. */
const STAKEOUT = playerSideScheme({
  id: "stakeout",
  startingThreat: flat(5),
  extra: { schemeIcons: ["hazard"], amplifyIcons: 1 },
});
/** "When Defeated: Place 1 threat on the main scheme for each side scheme in play." It counts itself, still in play. */
const LEDGER_DEFEATED = stubAbility(
  "ledger.when-defeated",
  def({
    trigger: { kind: "whenDefeated" },
    effects: [
      {
        kind: "placeThreat",
        target: { kind: "mainScheme" },
        amount: { kind: "count", query: { categories: ["sideScheme"] } },
      },
    ],
  }),
);
const LEDGER = playerSideScheme({ id: "ledger", startingThreat: flat(2), extra: { abilities: [LEDGER_DEFEATED.ref] } });
const TROPHY = playerSideScheme({
  id: "trophy",
  startingThreat: flat(2),
  extra: { keywords: [{ name: "victory", value: 0 }] },
});

/** An encounter side scheme with the same marker: no player controls it. */
const LAIR_DEFEATED = whenDefeatedMarks("lair.when-defeated");
const LAIR = stubSideScheme({ id: "lair", startingThreat: 3, abilities: [LAIR_DEFEATED.ref] });

const afterMainSchemeThwarted = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(
    `${id}.forced-response`,
    def({
      trigger: { kind: "response", forced: true, on: { on: "removeThreat", targetIs: { categories: ["mainScheme"] } } },
      effects: [...effects],
    }),
  );
  return { card: stubEnvironment({ id, abilities: [ability.ref] }), ability };
};
/** "Forced Response: After threat is removed from the main scheme, place 1 threat on each side scheme." */
const RIPTIDE = afterMainSchemeThwarted("riptide", [{ kind: "placeThreat", target: eachSideScheme, amount: n(1) }]);
/** "… place 1 threat on the main scheme for each side scheme in play." */
const TALLY = afterMainSchemeThwarted("tally", [
  {
    kind: "placeThreat",
    target: { kind: "mainScheme" },
    amount: { kind: "count", query: { categories: ["sideScheme"] } },
  },
]);
const ENVIRONMENTS = [RIPTIDE, TALLY];

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Remove 9 threat from each side scheme." */
const RAID = actionEvent("raid", [{ kind: "removeThreat", target: eachSideScheme, amount: n(9) }]);
/** "Discard each side scheme." (the undefeated discard the player side scheme limit performs, §3.2) */
const SWEEP = actionEvent("sweep", [{ kind: "discardFromPlay", target: eachSideScheme }]);
const DOOM = actionEvent("doom", [
  { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(50) },
]);
const EVENTS = [RAID, SWEEP, DOOM];
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 3, hp: 3 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  MISSION_DEFEATED,
  LEDGER_DEFEATED,
  LAIR_DEFEATED,
  ...ENVIRONMENTS.map((e) => e.ability),
  ...EVENTS.map((e) => e.ability),
);
const PLAYER_CARDS: readonly AnyCard[] = [MISSION, STAKEOUT, LEDGER, TROPHY, SCOUT, ...EVENTS.map((e) => e.card)];

/** Two players (by default) in hero form at the first player's first turn, the main scheme at 6 threat. */
function start(players: 2 | 3 = 2): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...PLAYER_CARDS, LAIR, FILLER, ...ENVIRONMENTS.map((e) => e.card)],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [LAIR.id, ...ENVIRONMENTS.map((e) => e.card.id), ...copiesOf(FILLER.id, 30)],
  });
  const main = base.mainScheme.instanceId;
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 6 } },
  };
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
function run(state: GameState, ...commands: readonly Command[]): Step {
  const { session, events } = driveSession(startSession(state), deps, commands);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
/** `player` plays `card` from hand for 0; the step's `id` is the played card. */
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  const step = run(given.state, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...step, id: given.id };
}
const endTurn = (state: GameState, player: PlayerId = P1) => run(state, { type: "endTurn", playerId: player }).state;
const thwart = (state: GameState, player: PlayerId, thwarter: InstanceId, scheme: InstanceId) =>
  run(state, { type: "basicThwart", playerId: player, thwarterInstanceId: thwarter, schemeInstanceId: scheme });
const withThreat = (state: GameState, id: InstanceId, value: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat: value } },
});
const hero = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const damage = (state: GameState) => [P1, P2].map((player) => mustInstance(state, hero(state, player)).damage);
const discardOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).discard;

describe("playing a player side scheme (RRG 1.8 p. 34)", () => {
  it("enters the villain's play area under the playing player's control with its per-player starting threat", () => {
    const played = play(start(), MISSION);
    expect(played.state.villainArea).toContain(played.id);
    expect(mustPlayer(played.state, P1).playArea).not.toContain(played.id);
    expect(mustInstance(played.state, played.id).controllerId).toBe(P1);
    // "3 per player" with two players.
    expect(threat(played.state, played.id)).toBe(6);
    expect(played.events).toContainEqual(expect.objectContaining({ type: "cardPlayed", instanceId: played.id }));
    expect(played.events).toContainEqual(
      expect.objectContaining({ type: "threatPlaced", schemeInstanceId: played.id, amount: 6 }),
    );
  });

  it("a flat starting threat does not scale with the players", () => {
    const played = play(start(), STAKEOUT);
    expect(threat(played.state, played.id)).toBe(5);
  });

  it("cannot be played on another player's turn", () => {
    const given = giveCard(start(), P2, MISSION.id);
    const result = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P2, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("removing threat from a player side scheme", () => {
  it("a hero's and an ally's basic thwart each remove their THW", () => {
    const played = play(start(), MISSION);
    const scout = playerCardIntoPlay(played.state, SCOUT.id, P1);
    const byHero = thwart(scout.state, P1, hero(scout.state, P1), played.id).state;
    expect(threat(byHero, played.id)).toBe(6 - 2);
    const byAlly = thwart(byHero, P1, scout.id, played.id).state;
    expect(threat(byAlly, played.id)).toBe(6 - 2 - 3);
  });

  it("an event naming side schemes defeats it: its When Defeated resolves, then it goes to its owner's discard pile", () => {
    const played = play(start(), MISSION);
    const raided = play(played.state, RAID.card);
    expect(raided.state.villainArea).not.toContain(played.id);
    expect(discardOf(raided.state, P1)).toContain(played.id);
    expect(raided.state.victoryDisplay).not.toContain(played.id);
    expect(threat(raided.state, played.id)).toBe(0);
    // P1's event removed the last threat, so P1 defeated it.
    expect(damage(raided.state)).toEqual([2, 0]);
    const types = raided.events.map((event) => event.type);
    expect(types.filter((type) => type === "schemeDefeated")).toHaveLength(1);
    const leaves = raided.events.findIndex((event) => event.type === "cardMoved" && event.instanceId === played.id);
    expect(types.indexOf("schemeDefeated")).toBeLessThan(leaves);
  });

  it("its When Defeated resolves while it is still in play", () => {
    const played = play(start(), LEDGER);
    const after = thwart(played.state, P1, hero(played.state, P1), played.id).state;
    // One side scheme in play as the When Defeated counts them: the defeated scheme itself.
    expect(threat(after, after.mainScheme.instanceId)).toBe(6 + 1);
    expect(discardOf(after, P1)).toContain(played.id);
  });

  it("with Victory 0 it goes to the victory display when defeated, not to a discard pile", () => {
    const played = play(start(), TROPHY);
    const after = thwart(played.state, P1, hero(played.state, P1), played.id).state;
    expect(after.victoryDisplay).toContain(played.id);
    expect(discardOf(after, P1)).not.toContain(played.id);
    expect(after.villainArea).not.toContain(played.id);
  });
});

describe("§3.1 gap 1: the scheme icons printed on a player side scheme", () => {
  it("a printed hazard icon and a printed amplify icon count while it is in play", () => {
    const before = start();
    expect(iconsInPlay(before, deps, "hazard")).toBe(0);
    expect(amplifyIconsInPlay(before, deps)).toBe(0);
    const played = play(before, STAKEOUT);
    expect(iconsOn(played.state, deps, played.id, "hazard")).toBe(1);
    expect(iconsOn(played.state, deps, played.id, "amplify")).toBe(1);
    expect(iconsInPlay(played.state, deps, "hazard")).toBe(1);
    expect(amplifyIconsInPlay(played.state, deps)).toBe(1);
    expect(iconsInPlay(played.state, deps, "crisis")).toBe(0);
  });

  it("one printing no icon has none", () => {
    const played = play(start(), MISSION);
    for (const icon of ["hazard", "crisis", "acceleration", "amplify"] as const) {
      expect(iconsOn(played.state, deps, played.id, icon)).toBe(0);
    }
    expect(iconsInPlay(played.state, deps, "hazard")).toBe(0);
  });
});

describe("§3.1 gap 2: a player side scheme discarded while it has threat", () => {
  it("goes to its owner's discard pile undefeated: no When Defeated, no defeat logged", () => {
    const played = play(start(), MISSION);
    const swept = play(played.state, SWEEP.card);
    expect(swept.state.villainArea).not.toContain(played.id);
    expect(discardOf(swept.state, P1)).toContain(played.id);
    expect(swept.state.victoryDisplay).not.toContain(played.id);
    expect(threat(swept.state, played.id)).toBe(0);
    expect(damage(swept.state)).toEqual([0, 0]);
    expect(swept.events.some((event) => event.type === "schemeDefeated")).toBe(false);
  });

  it("with Victory 0 it is still discarded, not added to the victory display", () => {
    const played = play(start(), TROPHY);
    const swept = play(played.state, SWEEP.card);
    expect(discardOf(swept.state, P1)).toContain(played.id);
    expect(swept.state.victoryDisplay).not.toContain(played.id);
  });
});

describe("§3.1 gap 3: 'the player who defeated this scheme'", () => {
  it("is the player whose thwart removed the last threat, not the scheme's controller", () => {
    const played = play(start(), MISSION);
    const p2Turn = endTurn(withThreat(played.state, played.id, 2));
    const after = thwart(p2Turn, P2, hero(p2Turn, P2), played.id).state;
    expect(discardOf(after, P1)).toContain(played.id);
    expect(damage(after)).toEqual([0, 2]);
  });

  // Q2 (owner, 2026-10-04): the When Defeated still resolves, with no player as its source, so no "after you …"
  // response answers it and no restriction on one player applies to it. Needs an ability of a player-controlled card
  // resolved with no player; today the frame's "you" is the scheme's controller and `defeatingPlayer` names nobody.
  it.todo("Q2: an encounter effect removes the last threat: the When Defeated resolves with no player as its source");
});

describe("§3.1 gap 4: encounter text naming side schemes includes player side schemes (RRG 1.8 p. 34)", () => {
  it("'place 1 threat on each side scheme' places it on a player side scheme too", () => {
    const played = play(start(), MISSION);
    const lair = encounterCardInVillainArea(played.state, LAIR.id, 3);
    const riptide = encounterCardInVillainArea(lair.state, RIPTIDE.card.id).state;
    const after = thwart(riptide, P1, hero(riptide, P1), riptide.mainScheme.instanceId).state;
    expect(threat(after, played.id)).toBe(6 + 1);
    expect(threat(after, lair.id)).toBe(3 + 1);
  });

  it("'for each side scheme in play' counts a player side scheme", () => {
    const lair = encounterCardInVillainArea(start(), LAIR.id, 3);
    const tally = encounterCardInVillainArea(lair.state, TALLY.card.id).state;
    const alone = thwart(tally, P1, hero(tally, P1), tally.mainScheme.instanceId).state;
    // The hero's THW of 2 comes off, then 1 for the encounter side scheme.
    expect(threat(alone, alone.mainScheme.instanceId)).toBe(6 - 2 + 1);
    const played = play(tally, MISSION);
    const both = thwart(played.state, P1, hero(played.state, P1), played.state.mainScheme.instanceId).state;
    expect(threat(both, both.mainScheme.instanceId)).toBe(6 - 2 + 2);
  });
});

describe("§3.1 gap 5: an eliminated player's player side scheme (RRG 1.8 'Player Elimination' step 4)", () => {
  it("goes to that player's discard pile with its threat cleared; another player's stays in play", () => {
    // Three players: the player side scheme limit is 2 (RRG 1.8 p. 34), so two can be in play together.
    const kept = play(start(3), STAKEOUT);
    const p2Turn = endTurn(kept.state);
    const lost = play(p2Turn, MISSION, P2);
    expect(threat(lost.state, lost.id)).toBe(9);
    const after = play(lost.state, DOOM.card, P2).state;
    expect(mustPlayer(after, P2).eliminated).toBe(true);
    expect(after.villainArea).not.toContain(lost.id);
    expect(discardOf(after, P2)).toContain(lost.id);
    expect(threat(after, lost.id)).toBe(0);
    // Leaving play this way is not a defeat: its When Defeated dealt nothing to the surviving player.
    expect(mustInstance(after, hero(after, P1)).damage).toBe(0);
    expect(after.villainArea).toContain(kept.id);
    expect(mustInstance(after, kept.id).controllerId).toBe(P1);
    expect(threat(after, kept.id)).toBe(5);
  });
});
