/**
 * docs/phase7-wave6.md §3.17: resolving a card's "When Defeated" abilities on demand. Zeal for the Cause (`mut_gen`
 * 32164): "Resolve the 'When Defeated' ability of each [Acolyte] minion engaged with you. If you are not engaged with
 * an [Acolyte] minion, …". `resolveSpecials.trigger: "whenDefeated"` resolves each card's printed When Defeated
 * abilities, and only those, with the card still in play: no defeat happens. Inside them, "the player who defeated
 * [this card]" is the resolving player (§4.1 Q10), not the engaged player a real defeat would read. Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playFree } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const one = { kind: "const", value: 1 } as const;

/** "When Defeated: The player who defeated [this minion] takes 1 damage." Also places 1 marker counter here. */
const ACO_DEFEATED = stubAbility(
  "aco.when-defeated",
  def({
    trigger: { kind: "whenDefeated" },
    effects: [
      { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "defeatingPlayer" } }, amount: one },
      { kind: "addCounters", target: { kind: "self" }, counterType: "marker", amount: one },
    ],
  }),
);
/** "When Revealed: Place 3 threat on the main scheme." Must not resolve. */
const ACO_REVEALED = stubAbility(
  "aco.when-revealed",
  def({
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
  }),
);
const ACO = stubMinion({ id: "aco", atk: 1, sch: 1, hp: 5, abilities: [ACO_DEFEATED.ref, ACO_REVEALED.ref] });
/** A minion with a When Revealed and no When Defeated. */
const PLAIN = stubMinion({ id: "plain", atk: 1, sch: 1, hp: 5, abilities: [ACO_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** "Resolve the 'When Defeated' ability of each minion [`engaged`]. If none was resolved, place 5 threat on the main scheme." */
const zeal = (id: string, minions: TargetQuery, player?: PlayerRef) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "resolveSpecials",
          of: { kind: "each", query: minions },
          trigger: "whenDefeated",
          ...(player ? { player } : {}),
          bind: "r",
        } as EffectSpec,
        {
          kind: "if",
          condition: { kind: "not", of: { kind: "varAtLeast", name: "r.count", amount: 1 } },
          then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 5 } }],
        },
      ],
    }),
  );
const ZEAL = zeal("zeal.action", { categories: ["minion"], engagedWith: "you" });
const ALL = zeal("all.action", { categories: ["minion"] });
const ALL_FOR_P2 = zeal("all-p2.action", { categories: ["minion"] }, { kind: "id", playerId: P2 });
const ZEAL_CARD = stubEvent({ id: "zeal", cost: 0, abilities: [ZEAL.ref] });
const ALL_CARD = stubEvent({ id: "all", cost: 0, abilities: [ALL.ref] });
const ALL_FOR_P2_CARD = stubEvent({ id: "all-p2", cost: 0, abilities: [ALL_FOR_P2.ref] });

const deps = depsOf(ACO_DEFEATED, ACO_REVEALED, ZEAL, ALL, ALL_FOR_P2);

/** Two players, P1 first; `engaged` minions put into play engaged with the given players (surgery, no reveal). */
function start(engaged: readonly (readonly [typeof ACO, PlayerId])[]) {
  let state = gameAtFirstTurn({
    cards: [ACO, PLAIN, BLANK, ZEAL_CARD, ALL_CARD, ALL_FOR_P2_CARD],
    deps,
    players: 2,
    deck: [ZEAL_CARD.id, ALL_CARD.id, ALL_FOR_P2_CARD.id],
    encounter: [ACO.id, ACO.id, PLAIN.id, ...copiesOf(BLANK.id, 20)],
  });
  const ids: InstanceId[] = [];
  for (const [card, player] of engaged) {
    const placed = minionEngagedWith(state, card.id, player);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, ids };
}

const damageOf = (state: GameState, player: PlayerId) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const threatOf = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const defeats = (events: readonly GameEvent[]) => events.filter((e) => e.type === "characterDefeated");

describe("§3.17 resolving a minion's 'When Defeated' without defeating it", () => {
  it("runs exactly the When Defeated ability; the minion stays in play, undamaged; no defeat happens", () => {
    const { state, ids } = start([[ACO, P1]]);
    const [aco] = ids;
    const threat = threatOf(state);
    const played = playFree(state, deps, ZEAL_CARD.id, P1);
    expect(damageOf(played.state, P1)).toBe(damageOf(state, P1) + 1);
    expect(damageOf(played.state, P2)).toBe(damageOf(state, P2));
    expect(mustInstance(played.state, aco!)).toEqual({
      ...mustInstance(state, aco!),
      counters: { ...mustInstance(state, aco!).counters, marker: 1 },
    });
    expect(mustPlayer(played.state, P1).playArea).toEqual(mustPlayer(state, P1).playArea);
    // No When Revealed (3 threat), and one ability resolved, so no fallback (5 threat).
    expect(threatOf(played.state)).toBe(threat);
    expect(defeats(played.events)).toEqual([]);
    expect(played.state.encounterDecks).toEqual(state.encounterDecks);
  });

  it("two of them: each resolves once", () => {
    const { state, ids } = start([
      [ACO, P1],
      [ACO, P1],
    ]);
    const played = playFree(state, deps, ZEAL_CARD.id, P1);
    expect(damageOf(played.state, P1)).toBe(damageOf(state, P1) + 2);
    for (const id of ids) expect(mustInstance(played.state, id).counters).toEqual({ marker: 1 });
    expect(threatOf(played.state)).toBe(threatOf(state));
  });

  it("Q10: 'the player who defeated it' is the resolving player, not the player it is engaged with", () => {
    const { state, ids } = start([[ACO, P2]]);
    const played = playFree(state, deps, ALL_CARD.id, P1);
    expect(damageOf(played.state, P1)).toBe(damageOf(state, P1) + 1);
    expect(damageOf(played.state, P2)).toBe(damageOf(state, P2));
    expect(mustPlayer(played.state, P2).playArea).toContain(ids[0]);
  });

  it("Q10 with `player`: the named player resolves it and is the player who defeated it", () => {
    const { state } = start([[ACO, P1]]);
    const played = playFree(state, deps, ALL_FOR_P2_CARD.id, P1);
    expect(damageOf(played.state, P1)).toBe(damageOf(state, P1));
    expect(damageOf(played.state, P2)).toBe(damageOf(state, P2) + 1);
  });

  it("a minion with no When Defeated: nothing resolves (count 0, the fallback runs), and it stays in play", () => {
    const { state, ids } = start([[PLAIN, P1]]);
    const played = playFree(state, deps, ZEAL_CARD.id, P1);
    expect(threatOf(played.state)).toBe(threatOf(state) + 5);
    expect(damageOf(played.state, P1)).toBe(damageOf(state, P1));
    expect(mustInstance(played.state, ids[0]!)).toEqual(mustInstance(state, ids[0]!));
    expect(mustPlayer(played.state, P1).playArea).toContain(ids[0]);
    expect(defeats(played.events)).toEqual([]);
  });

  it("replays deep-equal", () => {
    const { state } = start([
      [ACO, P1],
      [ACO, P2],
      [PLAIN, P1],
    ]);
    const played = playFree(state, deps, ALL_CARD.id, P1);
    const replayed = replay(played.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(played.state);
  });
});
