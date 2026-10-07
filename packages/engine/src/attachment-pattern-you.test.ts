/**
 * "You" inside a trigger pattern's own queries (`sourceIs`, `targetIs`) on an uncontrolled card whose "you" the rules
 * name: an encounter attachment on a player card ("it refers to the attached player card's controller", RRG 1.8
 * "Attachment", p. 8) and an obligation ("apply only to the player whose play area the obligation is in", RRG 1.8
 * "Obligation", p. 30). `controller: "you"` in those queries is that player, as the pattern's `playerIs: "controller"`
 * and the card's rules already read it. An attachment on a card no player controls names no one.
 *
 * Synthetic cards: a support with "Action: place 1 used counter here"; an attachment and an obligation counting, each
 * in its own counter, the abilities resolved on supports "you" control and the counters placed on them.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubObligation, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const add = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});
const forced = (on: EventPattern, counterType: string): AbilityDefinition => ({
  trigger: { kind: "response", forced: true, on },
  effects: [add(counterType)],
});
const yourSupport: TargetQuery = { categories: ["support"], controller: "you" };

const JET_ACTION = stubAbility("jet.action", { trigger: { kind: "action" }, effects: [add("used")] });
const JET = stubSupport({ id: "jet", cost: 0, abilities: [JET_ACTION.ref] });

/** "After an ability on a support you control resolves": `sourceIs` alone says whose. */
const SOURCE = stubAbility("collar.source", forced({ on: "abilityResolved", sourceIs: yourSupport }, "source"));
/** The same with "you resolve" as well (`playerIs`). */
const SOURCE_BY_YOU = stubAbility(
  "collar.source-by-you",
  forced({ on: "abilityResolved", playerIs: "controller", sourceIs: yourSupport }, "sourceByYou"),
);
/** "After a counter is placed on a support you control": `targetIs`. */
const TARGET = stubAbility("collar.target", forced({ on: "countersPlaced", targetIs: yourSupport }, "target"));
const COLLAR = stubAttachment({
  id: "collar",
  attachesTo: { kind: "yourIdentity" },
  abilities: [SOURCE.ref, SOURCE_BY_YOU.ref, TARGET.ref],
});
const BURDEN_SOURCE = stubAbility("burden.source", forced({ on: "abilityResolved", sourceIs: yourSupport }, "source"));
const BURDEN = stubObligation({ id: "burden", abilities: [BURDEN_SOURCE.ref] });

const deps: EngineDeps = depsOf(JET_ACTION, SOURCE, SOURCE_BY_YOU, TARGET, BURDEN_SOURCE);

interface Table {
  readonly state: GameState;
  readonly collar: InstanceId;
  readonly burden: InstanceId;
  readonly jets: Readonly<Record<PlayerId, InstanceId>>;
}

/** Two players at P1's first turn, a jet each; the collar attached to `host`, the burden in P2's play area. */
function start(hostOf: (state: GameState) => InstanceId): Table {
  const base = gameAtFirstTurn({
    cards: [COLLAR, JET, BURDEN],
    deps,
    players: 2,
    deck: [JET.id],
    encounter: [COLLAR.id, BURDEN.id, ...copiesOf(TREACHERY.id, 30)],
  });
  const deckId = activeEncounterDeckId(base);
  const piles = base.encounterDecks[deckId]!;
  const find = (card: CardId): InstanceId => {
    const id = piles.deck.find((candidate) => base.instances[candidate]?.cardId === card);
    if (!id) throw new Error(`no ${card} in the encounter deck`);
    return id;
  };
  const collar = find(COLLAR.id);
  const burden = find(BURDEN.id);
  const host = hostOf(base);
  const surgery: GameState = {
    ...base,
    encounterDecks: {
      ...base.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== collar && id !== burden) },
    },
    players: base.players.map((p) => (p.playerId === P2 ? { ...p, playArea: [...p.playArea, burden] } : p)),
    instances: {
      ...base.instances,
      [collar]: { ...mustInstance(base, collar), attachedTo: host, faceup: true, controllerId: null },
      [burden]: { ...mustInstance(base, burden), faceup: true, controllerId: null },
      [host]: { ...mustInstance(base, host), attachments: [...mustInstance(base, host).attachments, collar] },
    },
  };
  const first = playerCardIntoPlay(surgery, JET.id, P1);
  const second = playerCardIntoPlay(first.state, JET.id, P2);
  return { state: second.state, collar, burden, jets: { [P1]: first.id, [P2]: second.id } };
}

const use = (playerId: PlayerId, cardInstanceId: InstanceId): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId,
  abilityId: JET_ACTION.ref.id,
  payment: [],
});
const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const onP2 = (state: GameState): InstanceId => mustPlayer(state, P2).identity.instanceId;

describe("'you' in a trigger pattern's sourceIs / targetIs on an attachment and an obligation", () => {
  it("another player's support is not 'a support you control' for an attachment on P2's identity", () => {
    const { state, collar, burden, jets } = start(onP2);
    const { session } = driveSession(startSession(state), deps, [use(P1, jets[P1]!)]);
    expect(counter(session.state, jets[P1]!, "used")).toBe(1);
    expect(counter(session.state, collar, "source")).toBe(0);
    expect(counter(session.state, collar, "sourceByYou")).toBe(0);
    expect(counter(session.state, collar, "target")).toBe(0);
    expect(counter(session.state, burden, "source")).toBe(0);
  });

  it("the host's player's support is: sourceIs, sourceIs with playerIs, and targetIs each answer once", () => {
    const { state, collar, burden, jets } = start(onP2);
    const { session } = driveSession(startSession(state), deps, [use(P1, jets[P1]!), endTurn(P1), use(P2, jets[P2]!)]);
    expect(counter(session.state, jets[P2]!, "used")).toBe(1);
    expect(counter(session.state, collar, "source")).toBe(1);
    expect(counter(session.state, collar, "sourceByYou")).toBe(1);
    expect(counter(session.state, collar, "target")).toBe(1);
    // The obligation in P2's play area reads "you" as P2 too.
    expect(counter(session.state, burden, "source")).toBe(1);
  });

  it("an attachment on the villain names no one: no player's support is 'yours'", () => {
    const { state, collar, jets } = start((s) => activeVillain(s).instanceId);
    const { session } = driveSession(startSession(state), deps, [use(P1, jets[P1]!), endTurn(P1), use(P2, jets[P2]!)]);
    expect([counter(session.state, jets[P1]!, "used"), counter(session.state, jets[P2]!, "used")]).toEqual([1, 1]);
    expect(counter(session.state, collar, "source")).toBe(0);
    expect(counter(session.state, collar, "sourceByYou")).toBe(0);
    expect(counter(session.state, collar, "target")).toBe(0);
  });
});
