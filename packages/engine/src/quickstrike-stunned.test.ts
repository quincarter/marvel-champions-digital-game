/**
 * A stunned minion's quickstrike attack is replaced by the removal of its stunned status card.
 *
 * RRG 1.8 "Stun, Stunned" (p. 41): "When this character would attack, remove each stunned status card from it
 * instead." "Quickstrike" (p. 36): "After a minion with the quickstrike keyword engages a player whose identity is in
 * hero form, that minion attacks that player": an attack like any other. The status is read as the attack would begin,
 * not as the keyword is queued, so a stun that lands in between (a response to the minion's entering play, heard
 * before the quickstrike of a minion put into play without a reveal: the owner's answer 38A) replaces it too
 * (`quickstrikeFrame`, `Frame<"event">.statusReplaces`).
 */

import { flat, type KeywordInstance, type MinionCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { replay } from "./engine.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUICKSTRIKE: readonly KeywordInstance[] = [{ name: "quickstrike" }];

/** "Forced Response: After a minion enters play, stun it." */
const FROST_RESPONSE = stubAbility("frost.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
  effects: [{ kind: "giveStatus", target: { kind: "eventTarget" }, status: "stunned" }],
});
const FROST = stubSupport({ id: "frost", cost: 0, abilities: [FROST_RESPONSE.ref] });

/** "Boost: Put this card into play engaged with you." — a minion engaging outside a reveal (`putIntoPlay`). */
const LURKER_BOOST = stubAbility("lurker.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "putIntoPlay", card: { kind: "self" }, controller: { kind: "controller" } }],
});

const STRIKER = stubMinion({ id: "striker", atk: 3, sch: 1, hp: 5, boostIcons: 0, keywords: QUICKSTRIKE });
const LURKER = stubMinion({
  id: "lurker",
  atk: 3,
  sch: 1,
  hp: 5,
  boostIcons: 1,
  keywords: QUICKSTRIKE,
  abilities: [LURKER_BOOST.ref],
});

const deps: EngineDeps = depsOf(FROST_RESPONSE, LURKER_BOOST);

/** p1's first turn, in hero form. `at`: the minion's place from the top of the encounter deck, over blanks. */
function game(minion: MinionCard, at: 0 | 1, options: { stunned?: boolean; frost?: boolean } = {}) {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [minion, BLANK, FROST],
    encounterDeck: [minion.id, ...Array.from({ length: 12 }, () => BLANK.id)],
    deck: [...DEFAULT_DECK, FROST.id],
    deps,
  });
  const deck = activeEncounterDeck(start).deck;
  const id = deck.find((other) => start.instances[other]?.cardId === minion.id);
  if (!id) throw new Error(`no ${minion.id}`);
  const rest = deck.filter((other) => other !== id);
  let state: GameState = withEncounterPiles(start, { deck: [...rest.slice(0, at), id, ...rest.slice(at)] });
  if (options.stunned) {
    // Test surgery: the minion carries a stunned status card as it enters play.
    const instance = mustInstance(state, id);
    state = {
      ...state,
      instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, stunned: 1 } } },
    };
  }
  if (options.frost) {
    const given = giveCard(state, p1, FROST.id);
    state = runCommands(given.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
  }
  return { state: runCommands(state, deps, toHero).state, id };
}

const attacks = (events: readonly GameEvent[], id: string): number =>
  events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id).length;
const initiated = (events: readonly GameEvent[], id: string): number =>
  events.filter(
    (e) =>
      e.type === "triggerEvent" &&
      e.phase === "initiated" &&
      e.event.kind === "enemyAttack" &&
      e.event.enemyInstanceId === id,
  ).length;
const stunsSpent = (events: readonly GameEvent[], id: string) =>
  events.filter((e) => e.type === "statusRemoved" && e.instanceId === id).map((e) => (e as { reason?: string }).reason);
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;

describe("a stunned minion's quickstrike attack (RRG 1.8 'Stun, Stunned' p. 41; 'Quickstrike' p. 36)", () => {
  it("control: a revealed quickstrike minion attacks the hero it engages", () => {
    const t = game(STRIKER, 1);
    const { state, events } = runCommands(t.state, deps, endTurn);
    expect(attacks(events, t.id)).toBe(1);
    // The villain's own attack (ATK 1), then the minion's (ATK 3).
    expect(identityDamage(state)).toBe(identityDamage(t.state) + 4);
  });

  it("revealed already stunned: no attack is initiated, no boost card is dealt, and the stunned card is discarded", () => {
    const t = game(STRIKER, 1, { stunned: true });
    const { state, events, session } = runCommands(t.state, deps, endTurn);
    expect(mustInstance(state, t.id).engagedWith).toBe(p1);
    expect(initiated(events, t.id)).toBe(0);
    expect(attacks(events, t.id)).toBe(0);
    expect(events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === t.id)).toEqual([]);
    expect(stunsSpent(events, t.id)).toEqual(["cancelledAttack"]);
    expect(mustInstance(state, t.id).statuses.stunned).toBe(0);
    // The villain's own attack (ATK 1) is all the hero took.
    expect(identityDamage(state)).toBe(identityDamage(t.state) + 1);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("put into play, a response to its entering play stuns it before quickstrike (38A): the attack is replaced", () => {
    // The villain's boost card puts the minion into play; it then activates with the engaged minions as usual.
    const plain = game(LURKER, 0);
    const control = runCommands(plain.state, deps, endTurn);
    expect(attacks(control.events, plain.id), "control: quickstrike, then its activation").toBe(2);

    const t = game(LURKER, 0, { frost: true });
    const { state, events } = runCommands(t.state, deps, endTurn);
    expect(stunsSpent(events, t.id)).toEqual(["cancelledAttack"]);
    // Quickstrike spent the stun, so the minion's activation in step two is an attack.
    expect(attacks(events, t.id)).toBe(1);
    expect(mustInstance(state, t.id).statuses.stunned).toBe(0);
  });
});
