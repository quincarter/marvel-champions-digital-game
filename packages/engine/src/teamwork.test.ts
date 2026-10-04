/**
 * The teamwork (trait) keyword (docs/phase7-wave6.md §3.1), proven with synthetic cards.
 *
 * RRG 1.8 "Teamwork (Trait)" (p. 43): "After a minion with teamwork enters play and engages a player, if there is at
 * least one other minion that shares the specified trait in play, the minion that just entered play activates against
 * the player it is engaged with." Only that minion activates (§4.1 Q1). On a reveal it resolves before the minion's
 * When Revealed, the way quickstrike does (§4.1 Q2, the user's ruling after ruling Feb 28, 2026 (4) answer 2; RRG 1.8
 * p. 43 itself says after). FAQ "Fabian Cortez (#159)" (p. 64): a minion his When Defeated puts into play does not see
 * him, since he is discarded as it enters.
 */

import { flat, trait, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { resolveTeamwork, teamworkFrame } from "./resolve/enter-play.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const ACOLYTE = trait("ACOLYTE");
const teamwork = { name: "teamwork", sharedTrait: ACOLYTE } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
const mark: EffectSpec = {
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType: "revealed",
  amount: { kind: "const", value: 1 },
};

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ONE_BOOST = stubTreachery({ id: "one-boost", boostIcons: 1 });
/** The minion entering play: teamwork (ACOLYTE), villainous, a When Revealed that leaves a mark. */
const RECRUIT = stubMinion({
  id: "recruit",
  traits: [ACOLYTE],
  atk: 2,
  sch: 2,
  hp: 5,
  boostIcons: 0,
  keywords: [teamwork, { name: "villainous" }],
  abilities: [ability("recruit.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [mark] })],
});
/** An ACOLYTE already in play, with teamwork of its own. */
const PARTNER = stubMinion({
  id: "partner",
  traits: [ACOLYTE],
  atk: 0,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  keywords: [teamwork],
});
/** A minion with no trait. */
const OUTSIDER = stubMinion({ id: "outsider", atk: 0, sch: 0, hp: 5, boostIcons: 0 });
/** "Each [outsider] minion gains the [ACOLYTE] trait." */
const INDOCTRINATE = stubSupport({
  id: "indoctrinate",
  cost: 0,
  abilities: [
    ability("indoctrinate.constant", {
      trigger: {
        kind: "constant",
        traitGrants: [{ trait: ACOLYTE, target: { categories: ["minion"], name: "outsider" } }],
      },
      effects: [],
    }),
  ],
});
/** Fabian Cortez's shape: "When Defeated: … puts that [ACOLYTE] minion into play engaged with them." */
const CORTEZ = stubMinion({
  id: "cortez",
  traits: [ACOLYTE],
  atk: 0,
  sch: 0,
  hp: 3,
  boostIcons: 0,
  keywords: [teamwork],
  abilities: [
    ability("cortez.when-defeated", {
      trigger: { kind: "whenDefeated" },
      effects: [
        { kind: "selectCards", slot: "m", cards: { kind: "encounter", zones: ["deck"], filter: { name: "recruit" } } },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: { kind: "firstPlayer" } },
      ],
    }),
  ],
});
const SMASH = stubEvent({
  id: "smash",
  cost: 0,
  abilities: [
    ability("smash.action", {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "dealDamage",
          target: { kind: "each", query: { categories: ["minion"], name: "cortez" } },
          amount: { kind: "const", value: 10 },
        },
      ],
    }),
  ],
});

const deps: EngineDeps = depsOf(...abilities);
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };

const ENCOUNTER: readonly AnyCard[] = [BLANK, ONE_BOOST, RECRUIT, PARTNER, OUTSIDER, CORTEZ];

/**
 * A game whose encounter deck is `top` then blanks, with `inPlay` (taken from the encounter deck) faceup in p1's play
 * area engaged with p1 (test surgery, so the order does not depend on the shuffle).
 */
function game(top: readonly AnyCard[], inPlay: readonly AnyCard[] = []): GameState {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [...ENCOUNTER, INDOCTRINATE, SMASH],
    encounterDeck: [...[...top, ...inPlay].map((card) => card.id), ...copies(BLANK.id, 15)],
    deck: [...DEFAULT_DECK, INDOCTRINATE.id, SMASH.id],
  });
  let deck = [...activeEncounterDeck(start).deck];
  const take = (card: AnyCard): InstanceId => {
    const id = deck.find((i) => start.instances[i]?.cardId === card.id) as InstanceId;
    deck = deck.filter((i) => i !== id);
    return id;
  };
  const topIds = top.map(take);
  const inPlayIds = inPlay.map(take);
  const surgery = withEncounterPiles(start, { deck: [...topIds, ...deck] });
  return {
    ...surgery,
    players: surgery.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, ...inPlayIds] } : p)),
    instances: {
      ...surgery.instances,
      ...Object.fromEntries(
        inPlayIds.map((id) => [
          id,
          { ...mustInstance(surgery, id), faceup: true, engagedWith: p1, controllerId: null },
        ]),
      ),
    },
  };
}

function play(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const idOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.instanceId as InstanceId;
const teamworkLog = (events: readonly GameEvent[]) => events.filter((e) => e.type === "keywordResolved");
const revealedAt = (events: readonly GameEvent[], card: AnyCard): number =>
  events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === card.id);
/** Who activated after `from` in the log, by card id. */
const activatedAfter = (events: readonly GameEvent[], state: GameState, from: number): readonly string[] =>
  events
    .slice(from)
    .flatMap((e) => (e.type === "enemyActivated" ? [String(state.instances[e.enemyInstanceId]?.cardId)] : []));
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const expectReplays = (session: ReturnType<typeof runCommands>["session"]) => {
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
};

describe("teamwork (trait)", () => {
  it("revealed in hero form with another ACOLYTE in play: it attacks its engaged player, boost card and all", () => {
    // Villain's boost (blank), then the recruit, then the recruit's own boost card (villainous).
    const start = game([BLANK, RECRUIT, ONE_BOOST], [PARTNER]);
    const { state, events, session } = runCommands(runCommands(start, deps, toHero).state, deps, endTurn);
    const recruit = idOf(state, RECRUIT);
    expect(teamworkLog(events)).toEqual([
      { type: "keywordResolved", keyword: "teamwork", instanceId: recruit, playerId: p1, trait: ACOLYTE },
    ]);
    // ATK 2 + 1 boost icon; the villain (ATK 0, blank boost) and the partner (ATK 0) dealt nothing.
    expect(identityDamage(state)).toBe(3);
    expect(mustInstance(state, recruit).engagedWith).toBe(p1);
    expect(mustPlayer(state, p1).playArea).toContain(recruit);
    expect(activeEncounterDeck(state).discard).toContain(idOf(state, ONE_BOOST));
    expect(threat(state)).toBe(0);
    expectReplays(session);
  });

  it("revealed in alter-ego form: it schemes against its engaged player instead", () => {
    const start = game([BLANK, RECRUIT, ONE_BOOST], [PARTNER]);
    const { state, events, session } = runCommands(start, deps, endTurn);
    expect(teamworkLog(events)).toHaveLength(1);
    // SCH 2 + 1 boost icon on the main scheme; no damage.
    expect(threat(state)).toBe(3);
    expect(identityDamage(state)).toBe(0);
    const activation = events.find((e) => e.type === "enemyActivated" && e.enemyInstanceId === idOf(state, RECRUIT));
    expect(activation).toEqual({
      type: "enemyActivated",
      enemyInstanceId: idOf(state, RECRUIT),
      activation: "scheme",
      playerId: p1,
    });
    expectReplays(session);
  });

  it("resolves before the minion's When Revealed (§4.1 Q2), the activation fully resolved first", () => {
    const start = game([BLANK, RECRUIT, ONE_BOOST], [PARTNER]);
    const { state, events } = runCommands(runCommands(start, deps, toHero).state, deps, endTurn);
    const recruit = idOf(state, RECRUIT);
    const at = (pred: (e: GameEvent) => boolean) => events.findIndex(pred);
    const revealed = revealedAt(events, RECRUIT);
    const keyword = at((e) => e.type === "keywordResolved");
    const attackResolved = at(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "resolved" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === recruit,
    );
    const whenRevealed = at((e) => e.type === "counterAdded" && e.counterType === "revealed");
    expect(revealed).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeLessThan(keyword);
    expect(keyword).toBeLessThan(attackResolved);
    expect(attackResolved).toBeLessThan(whenRevealed);
    expect(mustInstance(state, state.mainScheme.instanceId).counters.revealed).toBe(1);
  });

  it("only the minion that entered play activates, not the ACOLYTE already there (§4.1 Q1)", () => {
    const start = game([BLANK, RECRUIT, ONE_BOOST], [PARTNER]);
    const { state, events } = runCommands(runCommands(start, deps, toHero).state, deps, endTurn);
    expect(activatedAfter(events, state, revealedAt(events, RECRUIT))).toEqual([RECRUIT.id]);
  });

  it("with no other ACOLYTE in play, nothing happens", () => {
    const start = game([BLANK, RECRUIT, ONE_BOOST], [OUTSIDER]);
    const { state, events, session } = runCommands(runCommands(start, deps, toHero).state, deps, endTurn);
    expect(teamworkLog(events)).toEqual([]);
    expect(activatedAfter(events, state, revealedAt(events, RECRUIT))).toEqual([]);
    expect(identityDamage(state)).toBe(0);
    expect(activeEncounterDeck(state).deck[0]).toBe(idOf(state, ONE_BOOST));
    expect(mustInstance(state, state.mainScheme.instanceId).counters.revealed).toBe(1);
    expectReplays(session);
  });

  it("a granted trait counts: a minion that gained ACOLYTE is a teammate", () => {
    const granted = play(game([BLANK, RECRUIT, ONE_BOOST], [OUTSIDER]), INDOCTRINATE).state;
    const { state, events, session } = runCommands(runCommands(granted, deps, toHero).state, deps, endTurn);
    expect(teamworkLog(events)).toEqual([
      { type: "keywordResolved", keyword: "teamwork", instanceId: idOf(state, RECRUIT), playerId: p1, trait: ACOLYTE },
    ]);
    expect(identityDamage(state)).toBe(3);
    expectReplays(session);
  });

  it("FAQ Fabian Cortez (#159): the minion his When Defeated puts into play does not see him", () => {
    const start = game([RECRUIT, ONE_BOOST], [CORTEZ]);
    const { state, events, session } = play(start, SMASH);
    const recruit = idOf(state, RECRUIT);
    expect(mustPlayer(state, p1).playArea).toContain(recruit);
    expect(mustInstance(state, recruit).engagedWith).toBe(p1);
    expect(activeEncounterDeck(state).discard).toContain(idOf(state, CORTEZ));
    expect(teamworkLog(events)).toEqual([]);
    expect(events.some((e) => e.type === "enemyActivated")).toBe(false);
    expect(threat(state)).toBe(0);
    expectReplays(session);
  });

  it("put into play by an effect with another ACOLYTE still in play: it activates (scheme, alter-ego)", () => {
    const start = game([RECRUIT, ONE_BOOST], [CORTEZ, PARTNER]);
    const { state, events, session } = play(start, SMASH);
    const recruit = idOf(state, RECRUIT);
    expect(teamworkLog(events)).toEqual([
      { type: "keywordResolved", keyword: "teamwork", instanceId: recruit, playerId: p1, trait: ACOLYTE },
    ]);
    expect(activatedAfter(events, state, 0)).toEqual([RECRUIT.id]);
    // SCH 2 + the 1-icon boost card from the top of the encounter deck.
    expect(threat(state)).toBe(3);
    expect(activeEncounterDeck(state).discard).toEqual(
      expect.arrayContaining([idOf(state, CORTEZ), idOf(state, ONE_BOOST)]),
    );
    expectReplays(session);
  });

  it("a minion in play but not engaged with a player does not activate", () => {
    const start = game([BLANK], [PARTNER, RECRUIT]);
    const recruit = idOf(start, RECRUIT);
    const unengaged: GameState = {
      ...start,
      instances: { ...start.instances, [recruit]: { ...mustInstance(start, recruit), engagedWith: null } },
    };
    const ctx = createCtx(unengaged, deps);
    expect(teamworkFrame(ctx, recruit)).toBeNull();
    resolveTeamwork(ctx, recruit);
    expect(ctx.events).toEqual([]);
    expect(ctx.state).toBe(unengaged);
    // Engaged, the same minion would.
    const engaged = createCtx(start, deps);
    resolveTeamwork(engaged, recruit);
    expect(teamworkLog(engaged.events)).toHaveLength(1);
  });
});
