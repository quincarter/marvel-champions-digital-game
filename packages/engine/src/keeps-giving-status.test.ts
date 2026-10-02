/**
 * docs/phase7-wave6.md §3.9: a status card a constant ability keeps giving (`RuleSpec keepsGivingStatus`). Synthetic
 * cards shaped like White Queen (`mut_gen` 32056: "While White Queen is engaged with you, you are confused.") and
 * Telepathic Restraint (32059: "While Telepathic Restraint is attached to your identity, you are stunned.").
 *
 * Sources: RRG 1.8 FAQ "White Queen (#56)" (p. 63: "she continuously places confused status cards on the engaged
 * player's identity until that identity cannot have any more … If that identity attempts to thwart, they can do so and
 * remove their confused status card(s), but will immediately be given more … When White Queen leaves play, any confused
 * status cards remain"); RRG 1.8 "Status Cards" (p. 41), "Steady", "Stalwart" (p. 40), "Confuse, Confused" (p. 13).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAttachment, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const youAre = (status: "confused" | "stunned"): RuleSpec => ({
  kind: "keepsGivingStatus",
  target: { categories: ["identity"], controlledBy: { kind: "controller" } },
  status,
});

const QUEEN_CONSTANT = stubAbility("queen.constant", {
  trigger: { kind: "constant", rules: [youAre("confused")] },
  effects: [],
});
/** "When White Queen enters play engaged with you, you are confused" as an edge, to show the level gives just once. */
const QUEEN_ENTERS = stubAbility("queen.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [
    {
      kind: "giveStatus",
      target: { kind: "identityOf", player: { kind: "engagedWith", of: { kind: "self" } } },
      status: "confused",
    },
  ],
});
const RESTRAINT_CONSTANT = stubAbility("restraint.constant", {
  trigger: { kind: "constant", rules: [youAre("stunned")] },
  effects: [],
});
const keywordOnYourIdentity = (name: "stalwart" | "steady") =>
  stubAbility(`${name}-grant.constant`, {
    trigger: {
      kind: "constant",
      keywordGrants: [{ keyword: { name }, target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  });
/** "Action: nothing." A command boundary, so the flow runs over a state built by surgery. */
const NOOP_ACTION = stubAbility("noop.action", { trigger: { kind: "action" }, effects: [] });
const STALWART_GRANT = keywordOnYourIdentity("stalwart");
const STEADY_GRANT = keywordOnYourIdentity("steady");

const QUEEN = stubMinion({
  id: "white-queen",
  atk: 0,
  sch: 0,
  hp: 2,
  boostIcons: 0,
  abilities: [QUEEN_CONSTANT.ref, QUEEN_ENTERS.ref],
});
const RESTRAINT = stubAttachment({ id: "restraint", abilities: [RESTRAINT_CONSTANT.ref] });
const STALWART = stubSupport({ id: "stalwart-grant", cost: 0, abilities: [STALWART_GRANT.ref] });
const STEADY = stubSupport({ id: "steady-grant", cost: 0, abilities: [STEADY_GRANT.ref] });
const NOOP = stubSupport({ id: "noop", cost: 0, abilities: [NOOP_ACTION.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  QUEEN_CONSTANT,
  QUEEN_ENTERS,
  RESTRAINT_CONSTANT,
  NOOP_ACTION,
  STALWART_GRANT,
  STEADY_GRANT,
);

function start(players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({
    cards: [QUEEN, RESTRAINT, NOOP, STALWART, STEADY, BLANK],
    deps,
    encounter: [QUEEN.id, QUEEN.id, RESTRAINT.id, ...copiesOf(BLANK.id, 30)],
    deck: [NOOP.id, STALWART.id, STEADY.id],
    players,
  });
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 5 },
    },
  };
}

const heroOf = (state: GameState, player: PlayerId = P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const confusedOf = (state: GameState, player: PlayerId = P1): number =>
  mustInstance(state, heroOf(state, player)).statuses.confused;
const statusLog = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "statusGiven" || e.type === "statusRemoved"
      ? [{ ...e } as { type: string; instanceId: InstanceId; status: string; reason?: string }]
      : [],
  );
const thwart = (state: GameState, player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: heroOf(state, player),
  schemeInstanceId: state.mainScheme.instanceId,
});
const attack = (state: GameState, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: heroOf(state, player),
  targetInstanceId: target,
});

function expectReplays(log: Parameters<typeof replay>[0], state: GameState): void {
  const replayed = replay(log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(state);
}

/**
 * Puts a no-op action support into p1's play and uses it: the first command boundary over a state built by surgery,
 * where the between-frames rules first see it. Returns the session after, and that command's events.
 */
function settle(state: GameState) {
  const noop = playerCardIntoPlay(state, NOOP.id, P1);
  return driveSession(startSession(noop.state), deps, [
    { type: "useAbility", playerId: P1, cardInstanceId: noop.id, abilityId: NOOP_ACTION.ref.id, payment: [] },
  ]);
}

describe("§3.9 keepsGivingStatus", () => {
  it("revealed and engaged with you: confused at once, one card, which the enters-play edge does not double", () => {
    // The villain's attack turns over one boost card (a blank) first; the encounter card dealt to p1 is White Queen.
    const state = onTopOfEncounterDeck(onTopOfEncounterDeck(start(), QUEEN.id), BLANK.id);
    const result = runCommands(state, deps, { type: "endTurn", playerId: P1 });
    const hero = heroOf(result.state);
    const queen = mustPlayer(result.state, P1).playArea.find(
      (id) => mustInstance(result.state, id).cardId === QUEEN.id,
    );
    expect(queen).toBeDefined();
    expect(mustInstance(result.state, queen!).engagedWith).toBe(P1);
    expect(confusedOf(result.state)).toBe(1);
    // Given exactly once, by the constant; the "When … enters play" edge found the identity already at capacity.
    expect(statusLog(result.events).filter((e) => e.instanceId === hero)).toEqual([
      { type: "statusGiven", instanceId: hero, status: "confused", reason: "constant" },
    ]);
    expectReplays(result.session.log, result.state);
  });

  it("a thwart attempt spends the confused card and cancels the thwart; another is given immediately", () => {
    const engaged = minionEngagedWith(start(), QUEEN.id, P1);
    const settled = settle(engaged.state);
    expect(confusedOf(settled.session.state)).toBe(1);
    const result = driveSession(settled.session, deps, [thwart(settled.session.state)]);
    const hero = heroOf(result.session.state);
    expect(statusLog(result.events)).toEqual([
      { type: "statusRemoved", instanceId: hero, status: "confused", reason: "cancelledSchemeOrThwart" },
      { type: "statusGiven", instanceId: hero, status: "confused", reason: "constant" },
    ]);
    expect(confusedOf(result.session.state)).toBe(1);
    expect(mustInstance(result.session.state, hero).exhausted).toBe(true);
    // Cancelled: no threat removed.
    expect(mustInstance(result.session.state, result.session.state.mainScheme.instanceId).threat).toBe(5);
    expectReplays(result.session.log, result.session.state);
  });

  it("a confused hero's attack does not spend the card; White Queen leaving play takes nothing back", () => {
    const engaged = minionEngagedWith(start(), QUEEN.id, P1);
    const settled = settle(engaged.state);
    const result = driveSession(settled.session, deps, [attack(settled.session.state, engaged.id)]);
    const state = result.session.state;
    expect(mustPlayer(state, P1).playArea).not.toContain(engaged.id); // defeated (2 ATK, 2 HP)
    expect(statusLog(result.events)).toEqual([]);
    expect(confusedOf(state)).toBe(1);
    expectReplays(result.session.log, state);
  });

  it("disengaged from you: no new card; the one held stays until a thwart spends it", () => {
    const engaged = minionEngagedWith(start(2), QUEEN.id, P1);
    const settled = settle(engaged.state);
    expect(confusedOf(settled.session.state, P1)).toBe(1);
    expect(confusedOf(settled.session.state, P2)).toBe(0);
    // Surgery: White Queen becomes engaged with p2 instead.
    const before = settled.session.state;
    const moved: GameState = {
      ...before,
      players: before.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((id) => id !== engaged.id) }
          : { ...p, playArea: [...p.playArea, engaged.id] },
      ),
      instances: { ...before.instances, [engaged.id]: { ...mustInstance(before, engaged.id), engagedWith: P2 } },
    };
    const noop = mustPlayer(moved, P1).playArea.find((id) => mustInstance(moved, id).cardId === NOOP.id)!;
    const result = runCommands(
      moved,
      deps,
      { type: "useAbility", playerId: P1, cardInstanceId: noop, abilityId: NOOP_ACTION.ref.id, payment: [] },
      thwart(moved, P1),
    );
    const p1Hero = heroOf(result.state, P1);
    const p2Hero = heroOf(result.state, P2);
    expect(statusLog(result.events)).toEqual([
      { type: "statusGiven", instanceId: p2Hero, status: "confused", reason: "constant" },
      { type: "statusRemoved", instanceId: p1Hero, status: "confused", reason: "cancelledSchemeOrThwart" },
    ]);
    expect(confusedOf(result.state, P1)).toBe(0);
    expect(confusedOf(result.state, P2)).toBe(1);
    expectReplays(result.session.log, result.state);
  });

  it("a stalwart identity is never confused; a steady one is kept at two, both spent and both given back", () => {
    const stalwart = playerCardIntoPlay(minionEngagedWith(start(), QUEEN.id, P1).state, STALWART.id);
    const none = settle(stalwart.state);
    expect(confusedOf(none.session.state)).toBe(0);
    expect(statusLog(none.events)).toEqual([]);

    const steadyStart = playerCardIntoPlay(minionEngagedWith(start(), QUEEN.id, P1).state, STEADY.id);
    const steady = settle(steadyStart.state);
    expect(confusedOf(steady.session.state)).toBe(2);
    const result = driveSession(steady.session, deps, [thwart(steady.session.state)]);
    const hero = heroOf(result.session.state);
    expect(statusLog(result.events)).toEqual([
      { type: "statusRemoved", instanceId: hero, status: "confused", reason: "cancelledSchemeOrThwart" },
      { type: "statusGiven", instanceId: hero, status: "confused", reason: "constant" },
      { type: "statusGiven", instanceId: hero, status: "confused", reason: "constant" },
    ]);
    expect(confusedOf(result.session.state)).toBe(2);
    expect(mustInstance(result.session.state, result.session.state.mainScheme.instanceId).threat).toBe(5);
    expectReplays(result.session.log, result.session.state);
  });

  it("Telepathic Restraint's shape: attached to your identity, a stunned attack is cancelled and re-stunned", () => {
    const base = start();
    const hero = heroOf(base);
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const piles = base.encounterDecks[deckId]!;
    const restraint = piles.deck.find((id) => mustInstance(base, id).cardId === RESTRAINT.id)!;
    const attached: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== restraint) },
      },
      instances: {
        ...base.instances,
        [restraint]: { ...mustInstance(base, restraint), attachedTo: hero, faceup: true },
        [hero]: { ...mustInstance(base, hero), attachments: [...mustInstance(base, hero).attachments, restraint] },
      },
    };
    const settled = settle(attached);
    expect(mustInstance(settled.session.state, hero).statuses.stunned).toBe(1);
    const villain = settled.session.state.villains[0]!.instanceId;
    const result = driveSession(settled.session, deps, [attack(settled.session.state, villain)]);
    expect(statusLog(result.events)).toEqual([
      { type: "statusRemoved", instanceId: hero, status: "stunned", reason: "cancelledAttack" },
      { type: "statusGiven", instanceId: hero, status: "stunned", reason: "constant" },
    ]);
    expect(mustInstance(result.session.state, villain).damage).toBe(0);
    expect(mustInstance(result.session.state, hero).statuses.stunned).toBe(1);
    expectReplays(result.session.log, result.session.state);
  });
});
