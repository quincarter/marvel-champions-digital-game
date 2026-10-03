/**
 * docs/phase7-wave6.md §3.26: the temporary keyword, an engine-owned forced interrupt to the round's end
 * (`phaseEnding { phase: "villain" }`) on every card in play that has temporary at that moment. Synthetic cards shaped
 * like Exploit Weakness / Practiced Defense / Priority Target (`cyclops` 33005–33007: upgrades attached to an enemy,
 * "Temporary."), a temporary support, and keyword grants/losses shaped like Field Commander (33004) and §3.13.
 *
 * Sources: RRG 1.8 "Temporary" (p. 44): "A card with temporary must be discarded from play at the end of the round …
 * equivalent to … 'Forced Interrupt: When the round ends, discard this card from play.'"; "'Loses'" (p. 27); "Gains"
 * (p. 20); "Villain Phase" (p. 47) step 6; "Forced" / simultaneous forced abilities ordered by the first player.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, KeywordGrantSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { TEMPORARY_ABILITY } from "./keyword-abilities.js";
import { hasKeyword } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const grantCard = (id: string, grant: KeywordGrantSpec) => {
  const ability = stubAbility(
    `${id}.constant`,
    def({ trigger: { kind: "constant", keywordGrants: [grant] }, effects: [] }),
  );
  return { ability, card: stubSideScheme({ id, startingThreat: 5, abilities: [ability.ref] }) };
};

/** "Each upgrade loses temporary." (Field Commander's second sentence, broadened.) */
const STEADFAST = grantCard("steadfast", {
  keyword: { name: "temporary" },
  target: { categories: ["upgrade"] },
  loses: true,
});
/** "Each support gains temporary." */
const FLEETING = grantCard("fleeting", { keyword: { name: "temporary" }, target: { categories: ["support"] } });

/** "Forced Interrupt: When this card leaves play, place 1 'left' counter on the main scheme." */
const FAREWELL = stubAbility("farewell.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: { kind: "mainScheme" }, counterType: "left", amount: n(1) }],
});
/** "Forced Response: After this card leaves play, place 1 'gone' counter on the main scheme." */
const AFTERWARD = stubAbility("afterward.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: { kind: "mainScheme" }, counterType: "gone", amount: n(1) }],
});
function n(value: number) {
  return { kind: "const", value } as const;
}

/** Exploit Weakness's shape: a temporary upgrade, attached to the villain below. */
const WEAKNESS = stubUpgrade({ id: "weakness", cost: 0, keywords: [{ name: "temporary" }] });
/** A temporary support with a "when this leaves play" interrupt and an "after" response. */
const BEACON = stubSupport({
  id: "beacon",
  cost: 0,
  keywords: [{ name: "temporary" }],
  abilities: [FAREWELL.ref, AFTERWARD.ref],
});
/** No keywords: only a grant makes it temporary. */
const PLAIN = stubSupport({ id: "plain", cost: 0 });

const deps = depsOf(STEADFAST.ability, FLEETING.ability, FAREWELL, AFTERWARD);
const PLAYER_CARDS = [WEAKNESS, BEACON, PLAIN];

function start(rules: readonly CardId[] = []) {
  let state = gameAtFirstTurn({
    cards: [...PLAYER_CARDS, STEADFAST.card, FLEETING.card],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [STEADFAST.card.id, FLEETING.card.id],
  });
  for (const rule of rules) state = encounterCardInVillainArea(state, rule, 5).state;
  return state;
}

/** Test surgery: `card` from P1's deck attached to the villain, under P1's control. */
function attachedToVillain(state: GameState, card: CardId): { readonly state: GameState; readonly id: InstanceId } {
  const placed = playerCardIntoPlay(state, card);
  const villain = placed.state.villains[0]!.instanceId;
  const seat = mustPlayer(placed.state, P1);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      players: placed.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: seat.playArea.filter((id) => id !== placed.id) } : p,
      ),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: villain },
        [villain]: {
          ...mustInstance(placed.state, villain),
          attachments: [...mustInstance(placed.state, villain).attachments, placed.id],
        },
      },
    },
  };
}

const endTurn: Command = { type: "endTurn", playerId: P1 };

/** P1 ends the turn and the round runs to the next player phase; the log replays to the same state. */
function endRound(state: GameState, pick: (state: GameState) => readonly string[] = defaultPick) {
  const driven = driveSession(startSession(state), deps, [endTurn], pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

const keywordLog = (events: readonly GameEvent[]) => events.filter((e) => e.type === "keywordResolved");
const discardOf = (state: GameState) => mustPlayer(state, P1).discard;
const playAreaOf = (state: GameState) => mustPlayer(state, P1).playArea;
const mainSchemeCounters = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).counters;

describe("§3.26 the temporary keyword", () => {
  it("a temporary upgrade on the villain is discarded to its owner's discard pile as the round ends", () => {
    const game = attachedToVillain(start(), WEAKNESS.id);
    const villain = game.state.villains[0]!.instanceId;
    expect(mustInstance(game.state, villain).attachments).toEqual([game.id]);
    const before = discardOf(game.state);
    const { state, events } = endRound(game.state);

    expect(state.round).toBe(game.state.round + 1);
    expect(mustInstance(state, villain).attachments).toEqual([]);
    expect(discardOf(state)).toEqual([game.id, ...before]);
    expect(mustInstance(state, game.id).attachedTo).toBeNull();
    expect(keywordLog(events)).toEqual([
      { type: "keywordResolved", keyword: "temporary", instanceId: game.id, playerId: P1 },
    ]);
    expect(events.filter((e) => e.type === "cardMoved" && e.instanceId === game.id)).toEqual([
      {
        type: "cardMoved",
        instanceId: game.id,
        cardId: WEAKNESS.id,
        from: { kind: "attachment", hostInstanceId: villain },
        to: { kind: "discard", playerId: P1 },
      },
    ]);
    // It resolves as a forced interrupt to the round's end, before the next round starts.
    const at = (predicate: (e: GameEvent) => boolean) => events.findIndex(predicate);
    const windowAt = at(
      (e) =>
        e.type === "windowOpened" &&
        e.timing === "interrupt" &&
        e.event.kind === "phaseEnding" &&
        e.event.phase === "villain",
    );
    expect(windowAt).toBeGreaterThanOrEqual(0);
    expect(events[windowAt]).toMatchObject({
      candidates: [{ instanceId: game.id, abilityId: TEMPORARY_ABILITY.abilityId, forced: true }],
    });
    expect(at((e) => e.type === "keywordResolved")).toBeGreaterThan(windowAt);
    expect(at((e) => e.type === "roundStarted")).toBeGreaterThan(at((e) => e.type === "keywordResolved"));
  });

  it("a card that lost temporary stays in play", () => {
    const game = attachedToVillain(start([STEADFAST.card.id]), WEAKNESS.id);
    expect(hasKeyword(game.state, game.id, "temporary", deps)).toBe(false);
    const villain = game.state.villains[0]!.instanceId;
    const { state, events } = endRound(game.state);
    expect(state.round).toBe(game.state.round + 1);
    expect(mustInstance(state, villain).attachments).toEqual([game.id]);
    expect(discardOf(state)).not.toContain(game.id);
    expect(keywordLog(events)).toEqual([]);
  });

  it("with no temporary card in play, the round's end is never announced (nothing hears it)", () => {
    const { events } = endRound(start([STEADFAST.card.id]));
    const ending = (events: readonly GameEvent[]) =>
      events.filter(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "initiated" &&
          e.event.kind === "phaseEnding" &&
          e.event.phase === "villain",
      );
    expect(ending(events)).toEqual([]);
    const temp = attachedToVillain(start(), WEAKNESS.id);
    const heard = endRound(temp.state).events;
    expect(ending(heard)).toHaveLength(1);
  });

  it("a granted temporary counts: a plain support is discarded", () => {
    const game = playerCardIntoPlay(start([FLEETING.card.id]), PLAIN.id);
    expect(hasKeyword(game.state, game.id, "temporary", deps)).toBe(true);
    const before = discardOf(game.state);
    const { state, events } = endRound(game.state);
    expect(playAreaOf(state)).not.toContain(game.id);
    expect(discardOf(state)).toEqual([game.id, ...before]);
    expect(keywordLog(events)).toEqual([
      { type: "keywordResolved", keyword: "temporary", instanceId: game.id, playerId: P1 },
    ]);
  });

  it("several temporary cards each discard, in one window, in the order the first player picks", () => {
    const upgrade = attachedToVillain(start(), WEAKNESS.id);
    const support = playerCardIntoPlay(upgrade.state, BEACON.id);
    const before = discardOf(support.state);

    let asked: readonly string[] | null = null;
    // The first player orders the simultaneous forced interrupts: reversed from the offered order.
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "orderTriggers" && choice.prompt.event.kind === "phaseEnding") {
        expect(choice.playerId).toBe(state.firstPlayerId);
        asked = choice.options.map((o) => o.optionId);
        return [...asked].reverse();
      }
      return defaultPick(state);
    };
    const { state, events } = endRound(support.state, pick);

    const temp = TEMPORARY_ABILITY.abilityId;
    expect(asked).toEqual([`${upgrade.id}:${temp}`, `${support.id}:${temp}`]);
    expect(
      events.filter((e) => e.type === "windowOpened" && e.event.kind === "phaseEnding" && e.event.phase === "villain"),
    ).toHaveLength(1);
    expect(keywordLog(events)).toEqual([
      { type: "keywordResolved", keyword: "temporary", instanceId: support.id, playerId: P1 },
      { type: "keywordResolved", keyword: "temporary", instanceId: upgrade.id, playerId: P1 },
    ]);
    // The last discarded is on top.
    expect(discardOf(state)).toEqual([upgrade.id, support.id, ...before]);
    expect(playAreaOf(state)).not.toContain(support.id);
    expect(mustInstance(state, state.villains[0]!.instanceId).attachments).toEqual([]);
  });

  it("its 'when this leaves play' interrupt and 'after' response resolve", () => {
    const game = playerCardIntoPlay(start(), BEACON.id);
    const { state, events } = endRound(game.state);
    expect(discardOf(state)).toContain(game.id);
    expect(mainSchemeCounters(state)).toMatchObject({ left: 1, gone: 1 });
    const resolved = events.flatMap((e) =>
      e.type === "abilityResolved" && e.instanceId === game.id ? [String(e.abilityId)] : [],
    );
    expect(resolved).toEqual([String(TEMPORARY_ABILITY.abilityId), "farewell.interrupt", "afterward.response"]);
  });
});
