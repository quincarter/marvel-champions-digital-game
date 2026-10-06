/**
 * RRG 1.8 "Attachment" (p. 8): "Only the player who controls the card to which that attachment is attached can trigger
 * abilities or pay costs on that attachment." Beside "Action" (p. 6): "Players can only trigger action abilities on
 * cards they control or on encounter cards." An encounter attachment's Action is any player's while it is attached to
 * an enemy or a scheme, and only the attached card's controller's while it is attached to a player's card. Text naming
 * who may trigger it (`triggerableBy`) replaces the rule. Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubMinion } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (d: AbilityDefinition) => d;
const self = { kind: "self" } as const;
/** "Action: Spend 1 resource → discard this card." */
const SHACKLE_ACTION = stubAbility(
  "shackle.action",
  def({
    trigger: { kind: "action" },
    cost: { resources: 1 },
    effects: [{ kind: "discardFromPlay", target: self }],
  }),
);
const SHACKLE = stubAttachment({ id: "shackle", abilities: [SHACKLE_ACTION.ref] });
/** The same, with "Any player may trigger this ability." */
const LATCH_ACTION = stubAbility(
  "latch.action",
  def({
    trigger: { kind: "action", triggerableBy: { kind: "each" } },
    cost: { resources: 1 },
    effects: [{ kind: "discardFromPlay", target: self }],
  }),
);
const LATCH = stubAttachment({ id: "latch", abilities: [LATCH_ACTION.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 5 });

const deps: EngineDeps = depsOf(SHACKLE_ACTION, LATCH_ACTION);

function table(): GameState {
  return gameAtFirstTurn({
    cards: [SHACKLE, LATCH, RECRUIT, THUG],
    deps,
    players: 2,
    deck: [RECRUIT.id],
    encounter: [...copiesOf(TREACHERY.id, 28), SHACKLE.id, LATCH.id, THUG.id],
  });
}

/** `card` out of the encounter deck and attached to `host` (surgery). */
function attachedTo(state: GameState, card: typeof SHACKLE, host: InstanceId): { state: GameState; id: InstanceId } {
  const placed = encounterCardInVillainArea(state, card.id);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: host },
        [host]: {
          ...mustInstance(placed.state, host),
          attachments: [...mustInstance(placed.state, host).attachments, placed.id],
        },
      },
    },
  };
}

const identityOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
/** `player` uses the attachment's Action, paying with the first card of their hand. */
const use = (state: GameState, player: PlayerId, id: InstanceId, abilityId = "shackle.action"): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [{ fromHand: mustPlayer(state, player).hand[0]! }],
});
const tryUse = (state: GameState, player: PlayerId, id: InstanceId, abilityId?: string) =>
  applyCommand(state, use(state, player, id, abilityId), deps);
const offered = (state: GameState, player: PlayerId, id: InstanceId): boolean => {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return false;
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === id);
};

describe("an encounter attachment's Action and who controls the attached card (RRG 1.8 p. 8)", () => {
  it("attached to p1's identity: p1 pays and discards it; p2 is refused and pays nothing", () => {
    const { state, id } = attachedTo(table(), SHACKLE, identityOf(table(), P1));
    const mine = tryUse(state, P1, id);
    expect(mine.ok).toBe(true);
    expect(mine.ok && mustInstance(mine.state, identityOf(state, P1)).attachments).toEqual([]);
    const theirs = tryUse(state, P2, id);
    expect(theirs.ok).toBe(false);
    expect(!theirs.ok && theirs.error.code).toBe("no_valid_target");
    expect(offered(state, P1, id)).toBe(true);
    expect(offered(state, P2, id)).toBe(false);
  });

  it("attached to p2's identity: p2 may use it during p1's turn, p1 may not", () => {
    const { state, id } = attachedTo(table(), SHACKLE, identityOf(table(), P2));
    expect(tryUse(state, P2, id).ok).toBe(true);
    expect(tryUse(state, P1, id).ok).toBe(false);
    expect(offered(state, P2, id)).toBe(true);
    expect(offered(state, P1, id)).toBe(false);
  });

  it("attached to an ally p1 controls: only p1", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id, P1);
    const { state, id } = attachedTo(ally.state, SHACKLE, ally.id);
    expect(tryUse(state, P1, id).ok).toBe(true);
    expect(tryUse(state, P2, id).ok).toBe(false);
  });

  it("attached to the villain: any player, as before", () => {
    const base = table();
    const { state, id } = attachedTo(base, SHACKLE, base.activeVillainId!);
    expect(tryUse(state, P1, id).ok).toBe(true);
    expect(tryUse(state, P2, id).ok).toBe(true);
  });

  it("attached to a minion engaged with p1: any player (no player controls the minion)", () => {
    const thug = minionEngagedWith(table(), THUG.id, P1);
    const { state, id } = attachedTo(thug.state, SHACKLE, thug.id);
    expect(tryUse(state, P1, id).ok).toBe(true);
    expect(tryUse(state, P2, id).ok).toBe(true);
  });

  it("attached to the main scheme: any player", () => {
    const base = table();
    const { state, id } = attachedTo(base, SHACKLE, base.mainScheme.instanceId);
    expect(tryUse(state, P1, id).ok).toBe(true);
    expect(tryUse(state, P2, id).ok).toBe(true);
  });

  it("'any player may trigger this ability' on the attachment replaces the rule", () => {
    const { state, id } = attachedTo(table(), LATCH, identityOf(table(), P1));
    expect(tryUse(state, P2, id, "latch.action").ok).toBe(true);
    expect(tryUse(state, P1, id, "latch.action").ok).toBe(true);
  });
});
