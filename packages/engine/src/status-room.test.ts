/**
 * docs/phase7-wave7.md §3.11, §4.1 Q8 = A: "does this character have room for a [stunned / confused / tough] status
 * card?" (`TargetQuery.canTakeStatus`). An encounter card's "choose: confuse a character you control, or …" offers the
 * first option only if it can be carried out in full, so the script asks whether a character the player controls
 * would actually receive the card, and then lets the player choose only among those.
 *
 * Sources: RRG 1.8 "Status Cards" (p. 41: "A character cannot have more than one status card of each type at a time";
 * "Characters with the steady keyword can have one additional confused status card and one additional stunned status
 * card"), "Stalwart" (p. 40: "This character cannot have confused or stunned status cards"), "Steady" (p. 41), "Stun,
 * Stunned" (p. 41) and "Confuse, Confused" (p. 13), "Tough" (p. 44). The query and `giveStatus` share one decision
 * (`canTakeStatus`, `keywords.ts`), which the last test drives from both sides.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { type EffectContext, evaluate, explainQuery, matchesQuery, selectTargets } from "./select.js";
import type { EffectSpec, Predicate, StatusName, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { type CardId, flat } from "@mc/content";
import { stubAlly, stubEvent, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const STATUSES: readonly StatusName[] = ["stunned", "confused", "tough"];
const room = (status: StatusName): TargetQuery => ({ canTakeStatus: status });
/** "A character you control" that a `status` card can be placed on. */
const yoursWithRoom = (status: StatusName): TargetQuery => ({
  categories: ["character"],
  controller: "you",
  canTakeStatus: status,
});

// "[This minion] cannot be stunned."
const RONAN_RULE = stubAbility("ronan.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotHaveStatus", target: { self: true }, statuses: ["stunned"] }] },
  effects: [],
});
// "[This minion] can have 1 additional tough status card."
const TITAN_RULE = stubAbility("titan.constant", {
  trigger: { kind: "constant", rules: [{ kind: "statusLimit", target: { self: true }, status: "tough", max: 2 }] },
  effects: [],
});

const SINISTER = stubVillain({ id: "sinister", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });
const minion = { atk: 0, sch: 0, hp: 4, boostIcons: 0 };
const BRUTE = stubMinion({ id: "brute", ...minion });
const RONAN = stubMinion({ id: "ronan", ...minion, abilities: [RONAN_RULE.ref] });
const TITAN = stubMinion({ id: "titan", ...minion, abilities: [TITAN_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const ally = { cost: 0, atk: 1, thw: 1, hp: 3 };
const SCOUT = stubAlly({ id: "scout", ...ally });
const ROCK = stubAlly({ id: "rock", ...ally, keywords: [{ name: "stalwart" }] });
const ANCHOR = stubAlly({ id: "anchor", ...ally, keywords: [{ name: "steady" }] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Give each character a [status] status card."
const GIVE_ALL = Object.fromEntries(
  STATUSES.map((status) => [
    status,
    event(`all-${status}`, [
      { kind: "giveStatus", target: { kind: "each", query: { categories: ["character"] } }, status },
    ]),
  ]),
) as Record<StatusName, ReturnType<typeof event>>;
// "Stun a character you control", chosen only among the characters that can take the card.
const STUN_ONE = event("stun-one", [
  { kind: "chooseTarget", slot: "target", query: yoursWithRoom("stunned"), chooser: { kind: "controller" } },
  { kind: "giveStatus", target: { kind: "slot", slot: "target" }, status: "stunned" },
]);
// "Choose: • Stun a character you control. • Place 2 threat on the main scheme." (Q8 = A: an option is offered only
// if it can be carried out in full.)
const STUN_OR_THREAT = event("stun-or-threat", [
  {
    kind: "chooseOne",
    chooser: { kind: "controller" },
    options: [
      {
        label: "Stun a character you control",
        condition: { kind: "exists", query: yoursWithRoom("stunned") },
        effects: STUN_ONE.ability.definition.effects,
      },
      {
        label: "Place 2 threat on the main scheme",
        effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
      },
    ],
  },
]);
const EVENTS = [...Object.values(GIVE_ALL), STUN_ONE, STUN_OR_THREAT];

const deps: EngineDeps = depsOf(RONAN_RULE, TITAN_RULE, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly otherHero: InstanceId;
  readonly villain: InstanceId;
  readonly scout: InstanceId;
  readonly rock: InstanceId;
  readonly anchor: InstanceId;
  readonly otherScout: InstanceId;
  readonly brute: InstanceId;
  readonly ronan: InstanceId;
  readonly titan: InstanceId;
}

/** Two players. P1: hero, Scout (plain), Rock (stalwart), Anchor (steady); P2: hero and a Scout; three minions. */
function table(): Table {
  let state = gameAtFirstTurn({
    deps,
    players: 2,
    villain: SINISTER,
    cards: [BRUTE, RONAN, TITAN, BLANK, SCOUT, ROCK, ANCHOR, ...EVENTS.map((e) => e.card)],
    encounter: [BRUTE.id, RONAN.id, TITAN.id, ...copiesOf(BLANK.id, 30)],
    deck: [SCOUT.id, ROCK.id, ANCHOR.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 4))],
  });
  const seat = (card: CardId, player: PlayerId = P1): InstanceId => {
    const seated = playerCardIntoPlay(state, card, player);
    state = seated.state;
    return seated.id;
  };
  const engage = (card: CardId): InstanceId => {
    const engaged = minionEngagedWith(state, card);
    state = engaged.state;
    return engaged.id;
  };
  const ids = {
    scout: seat(SCOUT.id),
    rock: seat(ROCK.id),
    anchor: seat(ANCHOR.id),
    otherScout: seat(SCOUT.id, P2),
    brute: engage(BRUTE.id),
    ronan: engage(RONAN.id),
    titan: engage(TITAN.id),
  };
  return {
    ...ids,
    state,
    hero: state.players[0]!.identity.instanceId,
    otherHero: state.players[1]!.identity.instanceId,
    villain: state.villains[0]!.instanceId,
  };
}

/** `id` holding `count` `status` cards (surgery, always within what the character may hold). */
function holding(state: GameState, id: InstanceId, status: StatusName, count: number): GameState {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, [status]: count } } },
  };
}

const asPlayer = (player: PlayerId): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});
const can = (state: GameState, id: InstanceId, status: StatusName): boolean =>
  matchesQuery(state, id, room(status), asPlayer(P1));
/** The statuses `id` has room for, in `STATUSES` order. */
const roomFor = (state: GameState, id: InstanceId): readonly StatusName[] => STATUSES.filter((s) => can(state, id, s));
const sorted = (ids: readonly string[]): readonly string[] => [...ids].sort();

function play(state: GameState, card: string, pick: (state: GameState) => readonly string[] = defaultPick) {
  const given = giveCard(state, P1, card);
  return runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

describe("§3.11 canTakeStatus: room for a status card", () => {
  it("a plain character holding no status card can take each kind (RRG p. 41)", () => {
    const t = table();
    expect(roomFor(t.state, t.hero)).toEqual(["stunned", "confused", "tough"]);
    expect(roomFor(t.state, t.scout)).toEqual(["stunned", "confused", "tough"]);
    expect(explainQuery(t.state, t.hero, room("stunned"), asPlayer(P1))).toBeNull();
  });

  it("an already stunned character cannot take stunned, and can take confused and tough (RRG p. 41)", () => {
    const t = table();
    const state = holding(t.state, t.hero, "stunned", 1);
    expect(roomFor(state, t.hero)).toEqual(["confused", "tough"]);
    expect(explainQuery(state, t.hero, room("stunned"), asPlayer(P1))).toBe("noStatusRoom");
  });

  it("an already confused or already tough character has no room for that card alone", () => {
    const t = table();
    expect(roomFor(holding(t.state, t.hero, "confused", 1), t.hero)).toEqual(["stunned", "tough"]);
    expect(roomFor(holding(t.state, t.hero, "tough", 1), t.hero)).toEqual(["stunned", "confused"]);
  });

  it("a stalwart character cannot take stunned or confused, and can take tough (RRG p. 40)", () => {
    const t = table();
    expect(roomFor(t.state, t.rock)).toEqual(["tough"]);
    expect(explainQuery(t.state, t.rock, room("confused"), asPlayer(P1))).toBe("noStatusRoom");
    expect(roomFor(holding(t.state, t.rock, "tough", 1), t.rock)).toEqual([]);
  });

  it("a steady character can take a second stunned or confused card and not a third (RRG p. 41)", () => {
    const t = table();
    for (const status of ["stunned", "confused"] as const) {
      expect(can(t.state, t.anchor, status)).toBe(true);
      expect(can(holding(t.state, t.anchor, status, 1), t.anchor, status)).toBe(true);
      expect(can(holding(t.state, t.anchor, status, 2), t.anchor, status)).toBe(false);
    }
    // Steady names only stunned and confused: one tough card is still the limit.
    expect(can(holding(t.state, t.anchor, "tough", 1), t.anchor, "tough")).toBe(false);
  });

  it("a tough limit of 2 allows a second tough card and not a third", () => {
    const t = table();
    expect(can(t.state, t.titan, "tough")).toBe(true);
    expect(can(holding(t.state, t.titan, "tough", 1), t.titan, "tough")).toBe(true);
    expect(can(holding(t.state, t.titan, "tough", 2), t.titan, "tough")).toBe(false);
    // The rule names tough only, and only that minion.
    expect(can(holding(t.state, t.titan, "stunned", 1), t.titan, "stunned")).toBe(false);
    expect(can(holding(t.state, t.brute, "tough", 1), t.brute, "tough")).toBe(false);
  });

  it('a "cannot be stunned" character has no room for stunned, and room for the other two', () => {
    const t = table();
    expect(roomFor(t.state, t.ronan)).toEqual(["confused", "tough"]);
    expect(explainQuery(t.state, t.ronan, room("stunned"), asPlayer(P1))).toBe("noStatusRoom");
  });

  it("reads a villain and a minion like any other character", () => {
    const t = table();
    expect(roomFor(t.state, t.villain)).toEqual(["stunned", "confused", "tough"]);
    expect(roomFor(t.state, t.brute)).toEqual(["stunned", "confused", "tough"]);
    const state = holding(holding(t.state, t.villain, "confused", 1), t.brute, "tough", 1);
    expect(roomFor(state, t.villain)).toEqual(["stunned", "tough"]);
    expect(roomFor(state, t.brute)).toEqual(["stunned", "confused"]);
    expect(
      sorted(selectTargets(state, { categories: ["villain", "minion"], ...room("stunned") }, asPlayer(P1))),
    ).toEqual(sorted([t.villain, t.brute, t.titan]));
  });

  it("under `not` it selects exactly the characters with no room", () => {
    const t = table();
    const state = holding(t.state, t.hero, "stunned", 1);
    const characters: TargetQuery = { categories: ["character"] };
    const withRoom = selectTargets(state, { ...characters, ...room("stunned") }, asPlayer(P1));
    const without = selectTargets(state, { ...characters, not: room("stunned") }, asPlayer(P1));
    expect(sorted(without)).toEqual(sorted([t.hero, t.rock, t.ronan]));
    expect(sorted(withRoom)).toEqual(
      sorted([t.otherHero, t.villain, t.scout, t.anchor, t.otherScout, t.brute, t.titan]),
    );
    expect(explainQuery(state, t.scout, { not: room("stunned") }, asPlayer(P1))).toBe("matchesNoAlternative");
  });

  describe('"you control a character that can take it" (`exists`)', () => {
    const youCanStun: Predicate = { kind: "exists", query: yoursWithRoom("stunned") };
    const youCanConfuse: Predicate = { kind: "exists", query: yoursWithRoom("confused") };

    it("is true while the identity or an ally you control has room", () => {
      const t = table();
      expect(evaluate(t.state, youCanStun, asPlayer(P1))).toBe(true);
      // The hero and the plain ally are stunned: the steady ally still has room for its first.
      const state = holding(holding(t.state, t.hero, "stunned", 1), t.scout, "stunned", 1);
      expect(selectTargets(state, yoursWithRoom("stunned"), asPlayer(P1))).toEqual([t.anchor]);
      expect(evaluate(state, youCanStun, asPlayer(P1))).toBe(true);
    });

    it("is false once none of your characters has room, whatever another player's characters can take", () => {
      const t = table();
      let state = holding(holding(t.state, t.hero, "stunned", 1), t.scout, "stunned", 1);
      state = holding(state, t.anchor, "stunned", 2);
      expect(selectTargets(state, yoursWithRoom("stunned"), asPlayer(P1))).toEqual([]);
      expect(evaluate(state, youCanStun, asPlayer(P1))).toBe(false);
      // The second player's hero and ally have room, and count only for the second player.
      expect(sorted(selectTargets(state, yoursWithRoom("stunned"), asPlayer(P2)))).toEqual(
        sorted([t.otherHero, t.otherScout]),
      );
      expect(evaluate(state, youCanStun, asPlayer(P2))).toBe(true);
      // A different status card is a different question.
      expect(evaluate(state, youCanConfuse, asPlayer(P1))).toBe(true);
    });

    it("an enemy with room is not a character you control", () => {
      const t = table();
      let state = t.state;
      for (const id of [t.hero, t.scout]) state = holding(state, id, "confused", 1);
      state = holding(state, t.anchor, "confused", 2);
      expect(can(state, t.villain, "confused")).toBe(true);
      expect(can(state, t.brute, "confused")).toBe(true);
      expect(evaluate(state, youCanConfuse, asPlayer(P1))).toBe(false);
    });
  });

  it("a chooseTarget restricted by it offers only the characters that can take the card", () => {
    const t = table();
    const state = holding(t.state, t.hero, "stunned", 1);
    const offered: (readonly string[])[] = [];
    const result = play(state, STUN_ONE.card.id, (parked) => {
      const choice = parked.pendingChoice;
      if (choice?.prompt.kind !== "chooseTarget") return defaultPick(parked);
      offered.push(choice.options.map((o) => o.optionId));
      return [t.anchor];
    });
    // Not the stunned hero, the stalwart ally, the other player's characters, or any enemy.
    expect(offered.map(sorted)).toEqual([sorted([t.scout, t.anchor])]);
    expect(mustInstance(result.state, t.anchor).statuses.stunned).toBe(1);
    expect(mustInstance(result.state, t.scout).statuses.stunned).toBe(0);
  });

  it("a choose option conditioned on it is offered while it can be carried out, and the other is forced when not", () => {
    const t = table();
    const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
    const labels: (readonly string[])[] = [];
    const pick = (parked: GameState): readonly string[] => {
      const choice = parked.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") labels.push(choice.options.map((o) => o.label));
      return defaultPick(parked);
    };
    const open = play(t.state, STUN_OR_THREAT.card.id, pick);
    expect(labels).toEqual([["Stun a character you control", "Place 2 threat on the main scheme"]]);
    expect(threat(open.state)).toBe(threat(t.state));
    expect(
      [t.hero, t.scout, t.anchor].reduce((sum, id) => sum + mustInstance(open.state, id).statuses.stunned, 0),
    ).toBe(1);

    // Every character P1 controls is at its limit: the stun cannot be carried out, so the threat is placed unasked.
    let full = holding(holding(t.state, t.hero, "stunned", 1), t.scout, "stunned", 1);
    full = holding(full, t.anchor, "stunned", 2);
    labels.length = 0;
    const forced = play(full, STUN_OR_THREAT.card.id, pick);
    expect(labels).toEqual([]);
    expect(threat(forced.state)).toBe(threat(full) + 2);
    expect(mustInstance(forced.state, t.otherHero).statuses.stunned).toBe(0);
  });

  it.each(STATUSES)(
    "agrees with giveStatus for every character: %s is placed exactly where there was room",
    (status) => {
      const t = table();
      const characters: readonly (readonly [string, InstanceId])[] = [
        ["hero", t.hero],
        ["other hero", t.otherHero],
        ["villain", t.villain],
        ["scout", t.scout],
        ["rock", t.rock],
        ["anchor", t.anchor],
        ["other scout", t.otherScout],
        ["brute", t.brute],
        ["ronan", t.ronan],
        ["titan", t.titan],
      ];
      const held = (state: GameState, id: InstanceId): number => mustInstance(state, id).statuses[status];
      const totals: number[] = [];
      let state = t.state;
      // Three rounds, so every character is asked while holding none, one and (where it may) two.
      for (let round = 0; round < 3; round++) {
        const predicted = characters.map(([name, id]) => [name, can(state, id, status)] as const);
        const after = play(state, GIVE_ALL[status].card.id).state;
        const placed = characters.map(([name, id]) => [name, held(after, id) - held(state, id) === 1] as const);
        expect(placed).toEqual(predicted);
        totals.push(characters.reduce((sum, [, id]) => sum + held(after, id), 0));
        state = after;
      }
      // Exact cards in play after each round, so agreement cannot be two wrongs.
      const expected: Record<StatusName, readonly number[]> = {
        // Round 1: all but stalwart Rock and "cannot be stunned" Ronan. Round 2: steady Anchor's second.
        stunned: [8, 9, 9],
        // Round 1: all but Rock. Round 2: Anchor's second.
        confused: [9, 10, 10],
        // Round 1: all ten. Round 2: Titan's second.
        tough: [10, 11, 11],
      };
      expect(totals).toEqual(expected[status]);
    },
  );
});
