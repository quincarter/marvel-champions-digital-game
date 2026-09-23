/**
 * docs/phase7-wave3.md §3.36: an either/or cost (`AbilityCost.either`, `costSelection.branch`) and a limit kept per
 * player (`AbilityLimit.per: "player"`). Synthetic cards shaped like The Grand Collection 1B (`gmw` 16073b): "Hero
 * Action: Choose to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection (to
 * its owner's discard pile). (Limit once per round per player.)"
 *
 * Sources: RRG 1.8 "Choose (Option)" (p. 12): a player "cannot choose an option that cannot be at least partially
 * resolved", including one with "a cost the player cannot pay"; "Cost" (p. 13): a cost is paid in full; "Limit"
 * (p. 27): "Each copy of an ability with such a limit may be used X times per the specified period, per instance of
 * that ability" — narrowed here by the card's own "per player".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostSelection, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment } from "./testing/fixtures.js";
import { RESOURCE, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const COLLECTION_ABILITY = stubAbility(
  "collection.action",
  def({
    trigger: { kind: "action", form: "hero" },
    cost: { either: [{ exhaustIdentity: true }, { resources: 2 }] },
    limit: { count: 1, period: "round", per: "player" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
const COLLECTION = stubEnvironment({ id: "collection", abilities: [COLLECTION_ABILITY.ref] });
const deps = depsOf(COLLECTION_ABILITY);

/** Both players in hero form, the shared card in the villain's area. */
function start(): { state: GameState; collection: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [COLLECTION],
    deps,
    players: 2,
    encounter: [COLLECTION.id, ...copiesOf(TREACHERY.id, 20)],
  });
  const placed = encounterCardInVillainArea(base, COLLECTION.id);
  const state: GameState = {
    ...placed.state,
    players: placed.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  return { state, collection: placed.id };
}
const use = (
  collection: InstanceId,
  player: PlayerId,
  costSelection?: CostSelection,
  payment: readonly Payment[] = [],
): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: collection,
  abilityId: COLLECTION_ABILITY.ref.id,
  payment,
  ...(costSelection ? { costSelection } : {}),
});
const exhausted = (state: GameState, player: PlayerId): boolean =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).exhausted;
/** Two resource cards from the player's hand, to pay "2 resources of any type". */
const twoResources = (state: GameState, player: PlayerId): readonly Payment[] =>
  mustPlayer(state, player)
    .hand.filter((id) => state.instances[id]?.cardId === RESOURCE.id)
    .slice(0, 2)
    .map((fromHand) => ({ fromHand }));

describe("§3.36 'Choose to either exhaust your hero or spend 2 resources of any type →'", () => {
  it("pays the branch the command names: 0 exhausts the hero, 1 spends two resources and leaves the hero ready", () => {
    const { state, collection } = start();
    const exhaust = driveSession(startSession(state), deps, [use(collection, P1, { branch: 0 })]).session.state;
    expect(exhausted(exhaust, P1)).toBe(true);
    const payment = twoResources(state, P1);
    expect(payment).toHaveLength(2);
    const { session } = driveSession(startSession(state), deps, [use(collection, P1, { branch: 1 }, payment)]);
    expect(exhausted(session.state, P1)).toBe(false);
    for (const { fromHand } of payment as { fromHand: InstanceId }[]) {
      expect(mustPlayer(session.state, P1).discard).toContain(fromHand);
    }
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with no branch named, pays the first one that can be paid; an out-of-range branch is refused", () => {
    const { state, collection } = start();
    expect(exhausted(driveSession(startSession(state), deps, [use(collection, P1)]).session.state, P1)).toBe(true);
    expect(applyCommand(state, use(collection, P1, { branch: 2 }), deps).ok).toBe(false);
    // Branch 1 with too little paid is refused: the resources are its whole cost.
    expect(applyCommand(state, use(collection, P1, { branch: 1 }), deps).ok).toBe(false);
  });

  it("is offered while either branch can be paid, and legalActions names the payable branches", () => {
    const { state, collection } = start();
    const branchesFor = (s: GameState): readonly number[] | undefined => {
      const actions = legalActions(s, P1, deps);
      if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
      return actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === collection)
        ?.costBranches;
    };
    expect(branchesFor(state)).toEqual([0, 1]);
    // An exhausted hero can still spend resources: only branch 1 is left.
    const identity = mustPlayer(state, P1).identity.instanceId;
    const tired: GameState = {
      ...state,
      instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), exhausted: true } },
    };
    expect(branchesFor(tired)).toEqual([1]);
    expect(applyCommand(tired, use(collection, P1, { branch: 0 }), deps).ok).toBe(false);
    expect(applyCommand(tired, use(collection, P1, { branch: 1 }, twoResources(tired, P1)), deps).ok).toBe(true);
  });

  it("'(Limit once per round per player.)': each player may use it once, the second use by the same player is refused", () => {
    const { state, collection } = start();
    const { session } = driveSession(startSession(state), deps, [use(collection, P1, { branch: 0 })]);
    const again = applyCommand(
      session.state,
      use(collection, P1, { branch: 1 }, twoResources(session.state, P1)),
      deps,
    );
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("limit_reached");
    // p2's turn: p2 has not used it this round.
    const p2Turn = driveSession(session, deps, [{ type: "endTurn", playerId: P1 }]).session;
    expect(p2Turn.state.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    const p2Use = driveSession(p2Turn, deps, [use(collection, P2, { branch: 0 })]).session;
    expect(exhausted(p2Use.state, P2)).toBe(true);
  });
});
