/**
 * docs/phase7-wave8.md §3.25: an attachment that prints no "attach to" text and makes its own host. "When Revealed:
 * Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion and attach this card
 * to it."
 *
 * Ruling February 20, 2026 – Ruling 4: "Reveal rules assume an attachment has 'attach to' text resolving upon being
 * revealed. If an attachment lacks 'attach to' text, it attaches when its 'When Revealed' ability triggers", which
 * corrects RRG 1.8 "Reveal" (p. 38) step 2 for these cards. So the card is turned faceup in front of the revealing
 * player, out of play (RRG 1.8 "In Play and Out of Play", p. 23: "If a card is out of play, its text is inactive and
 * cannot affect the game"), its When Revealed resolves, and it is discarded if it is still unattached afterward (RRG
 * 1.8 "Attach To", p. 8: "If such a card cannot remain in its prior state or game area, discard it"). A discard that
 * empties the encounter deck ends the search: "that card ability is considered to be fulfilled" (RRG 1.8 "Encounter
 * Deck", p. 17). The reveal step itself is proven in `self-attaching-attachment.test.ts`; this file proves the shape
 * that finds its host by revealing it. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeEncounterDeck, characterStat, locateCard, maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubAttachment,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO, withEncounterPiles } from "./testing/scenario.js";
import { P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const threat = (value: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "const", value },
});
const HOST = { categories: ["minion"], hostOfSelf: true } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
/** A minion of ATK 1, SCH 1 and 3 hit points with quickstrike. */
const RAPTOR = stubMinion({ id: "raptor", atk: 1, sch: 1, hp: 3, boostIcons: 0, keywords: [{ name: "quickstrike" }] });

/** "Attached minion gets +2 hit points and gains guard." */
const HARNESS_CONSTANT = stubAbility("harness.constant", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "hp", amount: 2, target: HOST }],
    keywordGrants: [{ keyword: { name: "guard" }, target: HOST }],
  },
  effects: [],
});
/**
 * "When Revealed: [if this card is in play, place 5 threat.] Discard cards from the top of the encounter deck until you
 * discard a minion. Reveal that minion and attach this card to it." The probe shows the card is out of play as its When
 * Revealed begins.
 */
const HARNESS_REVEALED = stubAbility("harness.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "if", condition: { kind: "exists", query: { self: true } }, then: [threat(5)] },
    { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "found" },
    { kind: "revealCard", cards: { kind: "slot", slot: "found" }, player: { kind: "controller" } },
    { kind: "attach", card: self, to: { kind: "slot", slot: "found" } },
  ],
});
/**
 * "Forced Response: After a minion enters play, place 1 threat on the main scheme." Text of a card that is not yet in
 * play when the minion it finds enters play, so it must stay silent.
 */
const HARNESS_WATCH = stubAbility("harness.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
  effects: [threat(1)],
});
const HARNESS = stubAttachment({
  id: "harness",
  statModifiers: { atk: 1, sch: 1 },
  abilities: [HARNESS_CONSTANT.ref, HARNESS_REVEALED.ref, HARNESS_WATCH.ref],
});

/** "Action: Discard each attachment." A player card's discard of the attachment. */
const SOLVENT_ACTION = stubAbility("solvent.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } }],
});
const SOLVENT = stubSupport({ id: "solvent", cost: 0, abilities: [SOLVENT_ACTION.ref] });

const deps = depsOf(HARNESS_CONSTANT, HARNESS_REVEALED, HARNESS_WATCH, SOLVENT_ACTION);

const find = (state: GameState, cardId: CardId): InstanceId => {
  const id = Object.keys(state.instances).find((key) => state.instances[key]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId}`);
  return id as InstanceId;
};
const all = (state: GameState, cardId: CardId): InstanceId[] =>
  (Object.keys(state.instances) as InstanceId[]).filter((key) => state.instances[key]?.cardId === cardId);

/**
 * P1 in hero form at their first turn, the encounter deck in this order from the top. The first card is the villain's
 * boost card, the second is dealt to the player, the rest are what the dealt card finds.
 */
function game(...encounter: readonly CardId[]): GameState {
  const result = createGame(
    {
      seed: 6,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, PLOT, RAPTOR, HARNESS, SOLVENT],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: encounter,
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, SOLVENT.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const begun = runCommands(result.state, deps).state;
  // The deck in the order asked for (surgery: setup shuffled it). Copies of one card are interchangeable.
  const left = [...activeEncounterDeck(begun).deck];
  const deck = encounter.map((cardId) => {
    const at = left.findIndex((id) => begun.instances[id]?.cardId === cardId);
    if (at < 0) throw new Error(`no ${cardId} left in the encounter deck`);
    return left.splice(at, 1)[0]!;
  });
  return {
    ...withEncounterPiles(begun, { deck }),
    players: begun.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
}

const endTurn: Command = { type: "endTurn", playerId: P1 };
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const heroId = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

describe("§3.25 an attachment with no 'attach to' finds its host from its own When Revealed", () => {
  it("two cards are discarded, the minion is revealed in full (its quickstrike attack at its own ATK), then the card attaches", () => {
    const start = game(BLANK.id, HARNESS.id, BLANK.id, PLOT.id, RAPTOR.id, BLANK.id, BLANK.id);
    const harness = find(start, HARNESS.id);
    const raptor = find(start, RAPTOR.id);
    const plot = find(start, PLOT.id);
    // What the card is while the minion it found attacks, read at that attack's defender prompt.
    const seen: { faceup: boolean; attachedTo: InstanceId | null; zone: string | undefined; inPlay: boolean }[] = [];
    const watching = (state: GameState) => {
      const prompt = state.pendingChoice?.prompt;
      if (prompt?.kind === "declareDefender" && prompt.attack.enemyInstanceId === raptor) {
        const card = mustInstance(state, harness);
        seen.push({
          faceup: card.faceup,
          attachedTo: card.attachedTo,
          zone: locateCard(state, harness)?.kind,
          inPlay: cardsInPlay(state).includes(harness),
        });
      }
      return defaultPick(state);
    };
    const run = runCommandsPicking(start, deps, watching, endTurn);
    const state = run.state;

    // Faceup in front of the revealing player, out of play and on nothing, while its When Revealed resolves.
    expect(seen).toEqual([{ faceup: true, attachedTo: null, zone: "dealtEncounter", inPlay: false }]);
    // The treachery and the side scheme above the minion were discarded, not revealed.
    expect(activeEncounterDeck(state).discard).toContain(plot);
    expect(cardsInPlay(state)).not.toContain(plot);
    expect(of(run.events, "encounterCardRevealed").map((e) => e.instanceId)).toEqual([harness, raptor]);
    // The minion engaged and its quickstrike attack resolved before the card attached: ATK 1, not 1 + 1.
    expect(mustInstance(state, raptor).engagedWith).toBe(P1);
    const attacks = of(run.events, "attackResolved").filter((e) => e.enemyInstanceId === raptor);
    expect(attacks).toMatchObject([{ baseAtk: 1, damageDealt: 1 }]);
    expect(mustInstance(state, heroId(state)).damage).toBe(1);
    // Then it attached: +2 hit points and guard from its text, +1 ATK and +1 SCH from its stat box.
    expect(mustInstance(state, harness).attachedTo).toBe(raptor);
    expect(cardsInPlay(state)).toContain(harness);
    expect(maxHitPoints(state, raptor, deps)).toBe(5);
    expect(hasKeyword(state, raptor, "guard", deps)).toBe(true);
    expect(characterStat(state, raptor, "atk", deps)).toBe(2);
    expect(characterStat(state, raptor, "sch", deps)).toBe(2);
    // Nothing of the card was in effect before that: it was out of play as its When Revealed began (no 5 threat), and
    // its "after a minion enters play" did not hear the minion it found (no 1 threat).
    expect(mainThreat(state)).toBe(mainThreat(start));
    const order = run.events.flatMap((e, at) =>
      (e.type === "attackResolved" && e.enemyInstanceId === raptor) ||
      (e.type === "cardMoved" && e.instanceId === harness && e.to.kind === "attachment")
        ? [{ type: e.type, at }]
        : [],
    );
    expect(order.map((e) => e.type)).toEqual(["attackResolved", "cardMoved"]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("no minion in the 4 cards of the deck: 4 discarded, the deck reset with one acceleration token, nothing revealed, the card discarded", () => {
    const start = game(BLANK.id, HARNESS.id, BLANK.id, PLOT.id, BLANK.id, BLANK.id);
    const harness = find(start, HARNESS.id);
    expect(activeEncounterDeck(start).deck).toHaveLength(6);
    const run = runCommands(start, deps, endTurn);
    const state = run.state;

    const searched = of(run.events, "cardMoved").filter(
      (e) => e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard",
    );
    expect(searched).toHaveLength(4);
    expect(of(run.events, "accelerationTokenAdded")).toHaveLength(1);
    // The search did not go on into the reshuffled deck: the boost card and the four it discarded are the deck again.
    expect(activeEncounterDeck(state).deck).toHaveLength(5);
    expect(of(run.events, "encounterCardRevealed").map((e) => e.instanceId)).toEqual([harness]);
    expect(activeEncounterDeck(state).discard).toEqual([harness]);
    expect(mustInstance(state, harness).attachedTo).toBeNull();
    expect(cardsInPlay(state)).not.toContain(harness);
    expect(all(state, PLOT.id).some((id) => cardsInPlay(state).includes(id))).toBe(false);
    expect(mainThreat(state)).toBe(mainThreat(start));
  });

  /** The found minion with the card attached and 4 damage on it, then a player card discards the attachment. */
  function attachmentDiscardedAtFourDamage() {
    const start = game(BLANK.id, HARNESS.id, RAPTOR.id, BLANK.id, BLANK.id, BLANK.id, BLANK.id, BLANK.id);
    const harness = find(start, HARNESS.id);
    const raptor = find(start, RAPTOR.id);
    const attached = runCommands(start, deps, endTurn).state;
    expect(mustInstance(attached, harness).attachedTo).toBe(raptor);
    const hurt: GameState = {
      ...attached,
      instances: { ...attached.instances, [raptor]: { ...mustInstance(attached, raptor), damage: 4 } },
    };
    expect(cardsInPlay(hurt)).toContain(raptor);
    const solvent = playerCardIntoPlay(hurt, SOLVENT.id);
    const run = runCommands(solvent.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: solvent.id,
      abilityId: SOLVENT_ACTION.ref.id,
      payment: [],
    });
    return { run, harness, raptor };
  }

  it("the attachment discarded by a player card takes its hit points, guard and stats with it", () => {
    const { run, harness, raptor } = attachmentDiscardedAtFourDamage();
    expect(cardsInPlay(run.state)).not.toContain(harness);
    expect(activeEncounterDeck(run.state).discard).toContain(harness);
    expect(maxHitPoints(run.state, raptor, deps)).toBe(3);
    expect(hasKeyword(run.state, raptor, "guard", deps)).toBe(false);
    expect(characterStat(run.state, raptor, "atk", deps)).toBe(1);
  });

  // RRG 1.8 "Hit Points" (p. 22): "If an ability that says an ally or minion 'gets +X hit points' ceases to be in
  // effect and causes that ally or minion to have damage on it equal to or greater than its hit points, that ally or
  // minion is defeated." The engine has no sweep for a hit point bonus ending (the gap docs/phase7-wave8.md §3.3
  // test 4 pins from the card side), so this stays red until it does; the companion pins what happens today.
  it.fails("attached minion with 4 damage: the attachment is discarded, so it has 3 hit points and is defeated", () => {
    const { run, raptor } = attachmentDiscardedAtFourDamage();
    expect(cardsInPlay(run.state)).not.toContain(raptor);
    expect(of(run.events, "characterDefeated").map((e) => e.instanceId)).toEqual([raptor]);
  });

  it("today: the minion stays in play with 4 damage on 3 hit points", () => {
    const { run, raptor } = attachmentDiscardedAtFourDamage();
    expect(cardsInPlay(run.state)).toContain(raptor);
    expect(mustInstance(run.state, raptor).damage).toBe(4);
    expect(of(run.events, "characterDefeated")).toHaveLength(0);
  });
});
