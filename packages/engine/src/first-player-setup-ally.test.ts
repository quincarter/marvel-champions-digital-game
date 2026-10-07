/**
 * docs/phase7-wave7.md §3.25 items 1–2: an ally that belongs to an encounter set, has the setup keyword and reads "The
 * first player controls [this]. [This] does not count against your ally limit." Synthetic cards only: the Ward (that
 * ally, with an encounter card back), a player's own setup ally, and a Ward without the control rule.
 *
 * Sources and the readings pinned here:
 * - RRG 1.8 Appendix II step 11 (p. 51) and "Setup (Keyword)" (p. 39): "A card with the setup keyword begins the game in
 *   play", found by searching "each deck". An ally found in the encounter deck enters play in the first player's play
 *   area, ready, under their control.
 * - "Ownership and Control" (p. 31): "The scenario is considered to be the owner of the encounter deck and each encounter
 *   card"; "Control of a card remains constant unless an ability explicitly causes the card to change control"; "If a
 *   character changes control while it is in play, it remains in the same state (i.e., readied or exhausted, damaged or
 *   not, etc.) and is moved to its new controller's play area"; "Upgrades on a card that changes control also change
 *   control to the same new controller".
 * - "First Player" (p. 19): the token passes at the end of the round, and "If the first player is eliminated, the first
 *   player token immediately passes clockwise to the next player". The RRG does not say whether "The first player
 *   controls X" names the player who is first now or the one who was first at setup. It is a constant ability in the
 *   present tense, so it is read as the explicit ability that changes control each time the token passes (the reading
 *   `RuleSpec controlledByFirstPlayer` already has for a support, docs/phase7-wave3.md §3.13).
 * - "Player Elimination" (p. 33): step 1 passes the token, step 3 discards the cards "in the eliminated player's play
 *   area" that they do not own. The ally follows the token at step 1, so it is no longer in that play area at step 3
 *   and stays in play. Without the control rule it is still there, and goes to the encounter discard pile.
 * - "Ally Limit" (p. 7): an ally that does not count is neither counted nor offered for the discard.
 *
 * Step 11 as written also searches the encounter set-aside area (docs/phase7-wave7.md §4.1 Q20 = B); that half is
 * pinned in `setup-keyword-set-aside.test.ts`, and nothing here sets a setup-keyword card aside.
 */

import { flat, type AllyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { playerId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const P3: PlayerId = playerId("p3");

const WARD_CONTROL = stubAbility("ward.control", {
  trigger: { kind: "constant", rules: [{ kind: "controlledByFirstPlayer", target: { self: true } }] },
  effects: [],
});
const WARD_LIMIT = stubAbility("ward.limit", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
const wardLike = (id: string, name: string, abilities: AllyCard["abilities"]): AllyCard => ({
  ...stubAlly({ id, cost: 0, atk: 2, thw: 2, hp: 5, keywords: [{ name: "setup" }], abilities }),
  name,
  unique: true,
  cardBack: "encounter",
});
/** "Setup. The first player controls the Ward. The Ward does not count against your ally limit." */
const WARD = wardLike("ward", "Ward", [WARD_CONTROL.ref, WARD_LIMIT.ref]);
/** The same ally without "The first player controls …": control never changes after setup. */
const STAY = wardLike("stay", "Stay", [WARD_LIMIT.ref]);
/** A player's own ally with the setup keyword, in each player's deck. */
const SQUIRE = stubAlly({ id: "squire", cost: 0, atk: 1, thw: 1, hp: 2, keywords: [{ name: "setup" }] });
/** "Attach to an ally." */
const PATCH = { ...stubUpgrade({ id: "patch", cost: 0 }), attachesTo: { kind: "ally" } } as const;
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 2 });
/** A side scheme reading "The Ward cannot ready." */
const BIND_RULE = stubAbility("bind.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotReady", target: { name: "Ward", controller: "any" } }] },
  effects: [],
});
const BIND = stubSideScheme({ id: "bind", startingThreat: 5, abilities: [BIND_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "ward-scheme",
  stages: [{ startingThreat: flat(6), targetThreat: flat(99), acceleration: flat(0) }],
});

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const n = (value: number) => ({ kind: "const", value }) as const;
const named = (name: string) => ({ kind: "named", name }) as const;
/** Defeats the identity of the player who plays it. */
const DOOM = action("doom", [
  { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(50) },
]);
/** 1 damage to the Ward and a stunned status card on it. */
const MARK = action("mark", [
  { kind: "dealDamage", target: named("Ward"), amount: n(1) },
  { kind: "giveStatus", target: named("Ward"), status: "stunned" },
]);
const ACTIONS = [DOOM, MARK];

const deps: EngineDeps = depsOf(WARD_CONTROL, WARD_LIMIT, BIND_RULE, ...ACTIONS.map((a) => a.ability));
const CARDS = [WARD, STAY, SQUIRE, PATCH, RECRUIT, BIND, BLANK, SCHEME, ...ACTIONS.map((a) => a.card)];
const EXTRA_DECK: readonly CardId[] = [PATCH.id, ...copiesOf(RECRUIT.id, 4), ...ACTIONS.map((a) => a.card.id)];

function start(
  players: 1 | 2 | 3,
  options: { readonly encounter?: readonly CardId[]; readonly deck?: readonly CardId[] } = {},
): GameState {
  return gameAtFirstTurn({
    cards: CARDS,
    deps,
    mainScheme: SCHEME,
    encounter: [...(options.encounter ?? [WARD.id]), ...copiesOf(BLANK.id, 30)],
    deck: [...EXTRA_DECK, ...(options.deck ?? [])],
    players,
  });
}

const idOf = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card)!.instanceId;
const alliesOf = (state: GameState, player: PlayerId): readonly CardId[] =>
  mustPlayer(state, player)
    .playArea.map((id) => mustInstance(state, id))
    .filter((i) => state.cardPool[i.cardId]?.type === "ally")
    .map((i) => i.cardId);
const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });
const toHero = (player: PlayerId): Command => ({ type: "changeForm", playerId: player });
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

/** Applies commands through a session, recording every prompt asked; choices are answered by `pick`. */
function drive(state: GameState | GameSession, commands: readonly Command[], pick = defaultPick) {
  const prompts: NonNullable<GameState["pendingChoice"]>[] = [];
  const session = "log" in state ? state : startSession(state);
  const result = driveSession(session, deps, commands, (current) => {
    if (current.pendingChoice) prompts.push(current.pendingChoice);
    return pick(current);
  });
  return { session: result.session, state: result.session.state, events: result.events, prompts };
}
/** `player` plays `card` from their deck for free (test surgery puts it in hand). */
function play(state: GameState, card: CardId, player: PlayerId = P1, attachTo: InstanceId | null = null) {
  const given = giveCard(state, player, card);
  const played = drive(given.state, [
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: attachTo },
  ]);
  return { ...played, id: given.id };
}
function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
const controlChanges = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "controllerChanged" && e.instanceId === id ? [{ from: e.from, to: e.to }] : []));

describe("§3.25 item 1: a setup-keyword ally in the encounter deck enters play at setup step 11", () => {
  it.each([1, 2, 3] as const)(
    "%i player(s): in play under the first player's control, ready, the scenario's, in no deck",
    (players) => {
      const state = start(players);
      const ward = idOf(state, WARD.id);
      expect(state.firstPlayerId).toBe(P1);
      expect(locateCard(state, ward)).toEqual({ kind: "playArea", playerId: P1 });
      expect(mustPlayer(state, P1).playArea).toContain(ward);
      expect(mustInstance(state, ward)).toMatchObject({
        controllerId: P1,
        ownerId: null,
        exhausted: false,
        faceup: true,
        damage: 0,
        home: { kind: "encounterDeck", deckId: activeEncounterDeckId(state) },
      });
      const piles = state.encounterDecks[activeEncounterDeckId(state)]!;
      expect(piles.deck).not.toContain(ward);
      expect(piles.discard).not.toContain(ward);
      for (const player of state.players) {
        expect(player.deck).not.toContain(ward);
        expect(player.discard).not.toContain(ward);
        expect(player.hand).not.toContain(ward);
        if (player.playerId !== P1) expect(player.playArea).not.toContain(ward);
      }
    },
  );

  it("does not count against the ally limit: a third ally beside it is kept, a fourth is the one over the limit", () => {
    let state = start(1);
    const ward = idOf(state, WARD.id);
    for (let i = 0; i < 2; i++) state = playerCardIntoPlay(state, ALLY.id, P1).state;
    // The Ward and two allies in play: a third ally makes four allies in the play area and three that count.
    const third = play(state, RECRUIT.id);
    expect(third.prompts.map((p) => p.prompt.kind)).not.toContain("discardOverAllyLimit");
    expect(alliesOf(third.state, P1)).toEqual([WARD.id, ALLY.id, ALLY.id, RECRUIT.id]);
    // A fourth: four count against a limit of three. The Ward is not offered for the discard.
    const fourth = play(third.state, RECRUIT.id);
    const asked = fourth.prompts.filter((p) => p.prompt.kind === "discardOverAllyLimit");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 3 });
    expect(asked[0]!.minSelections).toBe(1);
    expect(asked[0]!.options).toHaveLength(4);
    expect(asked[0]!.options.map((o) => o.optionId)).not.toContain(ward);
    expect(alliesOf(fourth.state, P1)).toEqual([WARD.id, ALLY.id, RECRUIT.id, RECRUIT.id]);
    expect(locateCard(fourth.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expectReplays(fourth.session);
  });

  it("entering play at setup with three allies' worth of setup cards asks for no ally limit discard", () => {
    // Each player's deck holds three setup allies; the Ward makes a fourth ally in the first player's play area.
    const state = start(2, { deck: copiesOf(SQUIRE.id, 3) });
    expect(alliesOf(state, P1)).toEqual([WARD.id, SQUIRE.id, SQUIRE.id, SQUIRE.id]);
    expect(alliesOf(state, P2)).toEqual([SQUIRE.id, SQUIRE.id, SQUIRE.id]);
    expect(state.pendingChoice).toBeNull();
  });

  it("attacks, thwarts and defends for its controller like any ally", () => {
    const state = start(1);
    const ward = idOf(state, WARD.id);
    const attacked = drive(state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: ward, targetInstanceId: villainOf(state) },
    ]);
    expect(mustInstance(attacked.state, villainOf(state)).damage).toBe(2);
    // ATK 2, one consequential damage (the stub's printed pip).
    expect(mustInstance(attacked.state, ward)).toMatchObject({ exhausted: true, damage: 1 });

    const scheme = state.mainScheme.instanceId;
    const thwarted = drive(state, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ward, schemeInstanceId: scheme },
    ]);
    expect(mustInstance(state, scheme).threat).toBe(6);
    expect(mustInstance(thwarted.state, scheme).threat).toBe(4);
    expect(mustInstance(thwarted.state, ward)).toMatchObject({ exhausted: true, damage: 1 });

    // The villain (ATK 2, no boost icons) attacks the hero; the Ward is declared as the defender.
    const defended = drive(state, [toHero(P1), endTurn(P1)], (current) =>
      current.pendingChoice?.prompt.kind === "declareDefender" ? [ward] : defaultPick(current),
    );
    expect(defended.events).toContainEqual(
      expect.objectContaining({ type: "defenderDeclared", defenderInstanceId: ward, playerId: P1 }),
    );
    expect(mustInstance(defended.state, ward).damage).toBe(2);
    expect(mustInstance(defended.state, mustPlayer(defended.state, P1).identity.instanceId).damage).toBe(0);
    expect(locateCard(defended.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expectReplays(defended.session);
  });

  it("a player's own setup ally is unchanged: under its owner's control, counted, and it does not follow the token", () => {
    // No Ward in this game's encounter deck: nothing is excluded from the count.
    const state = start(2, { encounter: [], deck: [SQUIRE.id] });
    const squires = Object.values(state.instances).filter((i) => i.cardId === SQUIRE.id);
    expect(squires.map((i) => [i.ownerId, i.controllerId])).toEqual([
      [P1, P1],
      [P2, P2],
    ]);
    for (const squire of squires) {
      expect(locateCard(state, squire.instanceId)).toEqual({ kind: "playArea", playerId: squire.ownerId });
    }
    const round2 = drive(state, [endTurn(P1), endTurn(P2)]);
    expect(round2.state.firstPlayerId).toBe(P2);
    for (const squire of squires) {
      expect(mustInstance(round2.state, squire.instanceId).controllerId).toBe(squire.ownerId);
      expect(controlChanges(round2.events, squire.instanceId)).toEqual([]);
    }
    // Counted against the limit: the squire and two allies are three, so each ally played after them is one too many.
    let full = state;
    for (let i = 0; i < 2; i++) full = playerCardIntoPlay(full, ALLY.id, P1).state;
    const over = play(play(full, RECRUIT.id).state, RECRUIT.id);
    expect(over.prompts.filter((p) => p.prompt.kind === "discardOverAllyLimit")).toHaveLength(1);
    expect(alliesOf(over.state, P1)).toHaveLength(3);
  });
});

describe("§3.25 item 2: control follows the first player token", () => {
  it("one player: it is still theirs in round 2", () => {
    const state = start(1);
    const ward = idOf(state, WARD.id);
    const round2 = drive(state, [endTurn(P1)]);
    expect(round2.state.round).toBe(2);
    expect(round2.state.firstPlayerId).toBe(P1);
    expect(mustInstance(round2.state, ward).controllerId).toBe(P1);
    expect(controlChanges(round2.events, ward)).toEqual([]);
  });

  it("two players: at the start of round 2 it is the new first player's, as it was: exhausted, damaged, stunned, with its upgrade", () => {
    const state = start(2);
    const ward = idOf(state, WARD.id);
    const patched = play(state, PATCH.id, P1, ward);
    const marked = play(patched.state, MARK.card.id);
    expect(mustInstance(marked.state, ward)).toMatchObject({ damage: 1, attachments: [patched.id] });
    // P1's hero is attacked in the villain phase (ATK 2, no boost icons) and the Ward defends: it is exhausted when the
    // token passes at the end of that phase. Players ready their cards at the end of the player phase, before it.
    const round2 = drive(marked.state, [toHero(P1), endTurn(P1), endTurn(P2)], (current) =>
      current.pendingChoice?.prompt.kind === "declareDefender" ? [ward] : defaultPick(current),
    );
    expect(round2.events).toContainEqual(
      expect.objectContaining({ type: "defenderDeclared", defenderInstanceId: ward, playerId: P1 }),
    );
    expect(round2.state.round).toBe(2);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(controlChanges(round2.events, ward)).toEqual([{ from: P1, to: P2 }]);
    expect(locateCard(round2.state, ward)).toEqual({ kind: "playArea", playerId: P2 });
    expect(mustPlayer(round2.state, P1).playArea).not.toContain(ward);
    // Moved as it is (RRG 1.8 "Ownership and Control", p. 31): still exhausted, 1 + 2 damage, stunned, the scenario's.
    expect(mustInstance(round2.state, ward)).toMatchObject({
      controllerId: P2,
      ownerId: null,
      exhausted: true,
      damage: 3,
      statuses: { stunned: 1, confused: 0, tough: 0 },
      attachments: [patched.id],
    });
    // The upgrade on it changes control with it, and stays P1's card.
    expect(mustInstance(round2.state, patched.id)).toMatchObject({ controllerId: P2, ownerId: P1, attachedTo: ward });
    // Not leaving or entering play: its one move is between the two play areas, and nothing readied it on the way.
    const after = round2.events.slice(round2.events.findIndex((e) => e.type === "defenderDeclared"));
    expect(after.flatMap((e) => (e.type === "cardMoved" && e.instanceId === ward ? [[e.from, e.to]] : []))).toEqual([
      [
        { kind: "playArea", playerId: P1 },
        { kind: "playArea", playerId: P2 },
      ],
    ]);
    const touched = after.filter(
      (e) => (e.type === "cardDiscardedFromPlay" || e.type === "cardReadied") && e.instanceId === ward,
    );
    expect(touched).toEqual([]);
    expectReplays(round2.session);
  });

  it("three players: it goes round the table with the token, P1 to P2 to P3", () => {
    const state = start(3);
    const ward = idOf(state, WARD.id);
    const round2 = drive(state, [endTurn(P1), endTurn(P2), endTurn(P3)]);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(mustInstance(round2.state, ward).controllerId).toBe(P2);
    const round3 = drive(round2.session, [endTurn(P2), endTurn(P3), endTurn(P1)]);
    expect(round3.state.firstPlayerId).toBe(P3);
    expect(locateCard(round3.state, ward)).toEqual({ kind: "playArea", playerId: P3 });
    expect(mustInstance(round3.state, ward).controllerId).toBe(P3);
    expect(controlChanges([...round2.events, ...round3.events], ward)).toEqual([
      { from: P1, to: P2 },
      { from: P2, to: P3 },
    ]);
  });

  it("held by 'cannot ready', it changes hands exhausted and stays exhausted for each controller in turn", () => {
    const bound = encounterCardInVillainArea(start(2, { encounter: [WARD.id, BIND.id] }), BIND.id, 5).state;
    const ward = idOf(bound, WARD.id);
    const round2 = drive(bound, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ward, schemeInstanceId: bound.mainScheme.instanceId },
      endTurn(P1),
      endTurn(P2),
    ]);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(mustInstance(round2.state, ward)).toMatchObject({ controllerId: P2, exhausted: true });
    const round3 = drive(round2.session, [endTurn(P2), endTurn(P1)]);
    expect(round3.state.firstPlayerId).toBe(P1);
    expect(mustInstance(round3.state, ward)).toMatchObject({ controllerId: P1, exhausted: true });
    const readied = [...round2.events, ...round3.events].filter(
      (e) => e.type === "cardReadied" && e.instanceId === ward,
    );
    expect(readied).toEqual([]);
    expect(controlChanges([...round2.events, ...round3.events], ward)).toEqual([
      { from: P1, to: P2 },
      { from: P2, to: P1 },
    ]);
  });

  it("the new first player uses it and it does not count against their ally limit either", () => {
    let state = drive(start(2), [endTurn(P1), endTurn(P2)]).state;
    const ward = idOf(state, WARD.id);
    expect(state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    for (let i = 0; i < 3; i++) state = playerCardIntoPlay(state, ALLY.id, P2).state;
    const settled = drive(state, []);
    expect(settled.prompts).toEqual([]);
    const attacked = drive(settled.state, [
      { type: "basicAttack", playerId: P2, attackerInstanceId: ward, targetInstanceId: villainOf(state) },
    ]);
    expect(mustInstance(attacked.state, villainOf(state)).damage).toBe(2);
    expect(alliesOf(attacked.state, P2)).toEqual([WARD.id, ALLY.id, ALLY.id, ALLY.id]);
  });
});

describe("§3.25 item 2: its controller is eliminated (RRG 1.8 'Player Elimination', p. 33)", () => {
  it("two players: it stays in play, as it was, under the next clockwise player", () => {
    const state = start(2);
    const ward = idOf(state, WARD.id);
    const patched = play(state, PATCH.id, P1, ward);
    // 1 damage and stunned from the event; exhausted by thwarting, with 1 consequential damage.
    const round1 = drive(play(patched.state, MARK.card.id).state, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ward, schemeInstanceId: state.mainScheme.instanceId },
    ]);
    const before = mustInstance(round1.state, ward);
    expect(before).toMatchObject({ exhausted: true, damage: 2, statuses: { stunned: 1 } });
    const gone = play(round1.state, DOOM.card.id, P1);
    expect(mustPlayer(gone.state, P1).eliminated).toBe(true);
    expect(gone.state.outcome).toBeNull();
    expect(gone.state.firstPlayerId).toBe(P2);
    expect(locateCard(gone.state, ward)).toEqual({ kind: "playArea", playerId: P2 });
    expect(controlChanges(gone.events, ward)).toEqual([{ from: P1, to: P2 }]);
    // The control change is logged after the token passes and before the player is recorded as eliminated.
    const order = gone.events.flatMap((e) =>
      e.type === "firstPlayerChanged" || e.type === "playerEliminated" || e.type === "controllerChanged"
        ? [e.type]
        : [],
    );
    expect(order.indexOf("firstPlayerChanged")).toBeLessThan(order.indexOf("controllerChanged"));
    expect(order.indexOf("controllerChanged")).toBeLessThan(order.indexOf("playerEliminated"));
    const after = mustInstance(gone.state, ward);
    expect(after).toMatchObject({
      controllerId: P2,
      ownerId: null,
      exhausted: true,
      damage: 2,
      statuses: before.statuses,
    });
    // The eliminated player's own upgrade on it is theirs: step 4 puts it in their discard pile.
    expect(after.attachments).toEqual([]);
    expect(locateCard(gone.state, patched.id)).toEqual({ kind: "discard", playerId: P1 });
    const piles = gone.state.encounterDecks[activeEncounterDeckId(gone.state)]!;
    expect(piles.discard).not.toContain(ward);
    expectReplays(gone.session);
  });

  it("three players: a player who is not first is eliminated and it does not move", () => {
    const p2Turn = drive(start(3), [endTurn(P1)]);
    const ward = idOf(p2Turn.state, WARD.id);
    const gone = play(p2Turn.state, DOOM.card.id, P2);
    expect(mustPlayer(gone.state, P2).eliminated).toBe(true);
    expect(gone.state.firstPlayerId).toBe(P1);
    expect(locateCard(gone.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expect(controlChanges(gone.events, ward)).toEqual([]);
  });

  it("three players: the first player is eliminated, then the next: it ends with the last player", () => {
    const state = start(3);
    const ward = idOf(state, WARD.id);
    const first = play(state, DOOM.card.id, P1);
    expect(first.state.firstPlayerId).toBe(P2);
    expect(locateCard(first.state, ward)).toEqual({ kind: "playArea", playerId: P2 });
    const p2Turn = drive(first.state, [endTurn(P1)]);
    expect(p2Turn.state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    const second = play(p2Turn.state, DOOM.card.id, P2);
    expect(second.state.firstPlayerId).toBe(P3);
    expect(second.state.outcome).toBeNull();
    expect(locateCard(second.state, ward)).toEqual({ kind: "playArea", playerId: P3 });
    expect(mustInstance(second.state, ward)).toMatchObject({ controllerId: P3, ownerId: null });
  });

  it("the last player is eliminated: it leaves play with them, to the encounter discard pile, and the game is lost", () => {
    const state = start(1);
    const ward = idOf(state, WARD.id);
    const gone = play(state, DOOM.card.id, P1);
    expect(gone.state.outcome).toMatchObject({ result: "loss", reason: "allPlayersDefeated" });
    expect(locateCard(gone.state, ward)).toEqual({
      kind: "encounterDiscard",
      deckId: activeEncounterDeckId(gone.state),
    });
  });

  it.todo(
    "a player-backed card the first player controls: whether ownership passes with control (RRG p. 31) is not built",
  );

  it("without 'The first player controls …' it stays where setup put it, and goes with its controller (step 3)", () => {
    const state = start(2, { encounter: [STAY.id] });
    const stay = idOf(state, STAY.id);
    expect(mustInstance(state, stay)).toMatchObject({ controllerId: P1, ownerId: null });
    const round2 = drive(state, [endTurn(P1), endTurn(P2)]);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(locateCard(round2.state, stay)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(round2.state, stay).controllerId).toBe(P1);
    // P1 is not the first player now; eliminated, the cards in their play area they do not own go to their owner's
    // discard pile: the scenario's.
    const p1Turn = drive(round2.session, [endTurn(P2)]);
    expect(p1Turn.state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
    const gone = play(p1Turn.state, DOOM.card.id, P1);
    expect(mustPlayer(gone.state, P1).eliminated).toBe(true);
    expect(locateCard(gone.state, stay)).toEqual({
      kind: "encounterDiscard",
      deckId: activeEncounterDeckId(gone.state),
    });
  });
});
