/**
 * docs/phase7-wave6.md §3.59: threat on cards that are not schemes (Mojo I–III, MojoMania 1B, Paparazzi, `mojo`).
 * §4 Q34 (default, §4.1): only card text places, moves or removes it. A character holding threat is not a scheme: it
 * cannot be thwarted, crisis and "threat cannot be removed from schemes" do not apply, and 0 threat defeats nothing. A
 * hero's change of form and a villain's flip are "flips"; MojoMania 1B moves the threat at the interrupt.
 *
 * Sources: RRG 1.8 "Hinder X" (p. 22: "a card … enters play with X threat on it"), "Threat" (p. 44), "Flip" (p. 20),
 * "Crisis Icon" (p. 14).
 */

import { flat, type AnyCard, type CardId, type ObligationCard, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { preview } from "./preview.js";
import { activeVillain, mustInstance } from "./query.js";
import { cardsInPlay, resolveRef } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { giveCard } from "./testing/scenario.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubObligation,
  stubSideScheme,
  stubSupport,
  stubVillain,
} from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const controller = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: controller };
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const eachObligation: TargetRef = { kind: "each", query: { categories: ["obligation"] } };

// --- Encounter cards -----------------------------------------------------------------------------------------------

/** Paparazzi's shape: an obligation with "Hinder 10". */
const PAPARAZZI: ObligationCard = {
  ...stubObligation({ id: "paparazzi", boostIcons: 0 }),
  keywords: [{ name: "hinder", value: 10 }],
};
const HINDERING_MINION = stubMinion({ id: "hindering-minion", hp: 5, keywords: [{ name: "hinder", value: 2 }] });
const PLAIN_MINION = stubMinion({ id: "plain-minion", hp: 2 });
const CRISIS_SCHEME = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"] });

/** MojoMania 1B's shape: "Forced Interrupt: When a character flips or leaves play, move all threat from that character
 * to this scheme." */
const MOVE_TO_SCHEME = stubAbility("mojomania.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: ["formChanged", "cardFlipped", "cardLeavesPlay"], targetIs: { categories: ["character"] } },
  },
  effects: [{ kind: "moveThreat", from: { kind: "eventTarget" }, to: { kind: "self" } }],
});
const MOJOMANIA = stubMainScheme({
  id: "mojomania",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [MOVE_TO_SCHEME.ref] }],
});
const QUIET_SCHEME = stubMainScheme({
  id: "quiet-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(1) }],
});
const TWO_FACED: VillainCard = stubVillain({
  id: "two-faced",
  stages: [{ hp: flat(20), atk: 1, sch: 1 }],
  back: { name: "two-faced", stages: [{ hp: flat(20), atk: 2, sch: 1 }] },
});

// --- Player cards --------------------------------------------------------------------------------------------------

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL_TOP = action("reveal-top", [{ kind: "revealEncounterCard", player: controller }]);
/** "Place 3 threat on your hero" (Mojo I's shape). */
const THREAT_ON_ME = action("threat-on-me", [{ kind: "placeThreat", target: yourIdentity, amount: n(3) }]);
const REMOVE_FROM_ME = action("remove-from-me", [{ kind: "removeThreat", target: yourIdentity, amount: n(2) }]);
const REMOVE_FROM_MAIN = action("remove-from-main", [
  { kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(1) },
]);
const CLEAR_MINIONS = action("clear-minions", [{ kind: "removeThreat", target: eachMinion, amount: n(9) }]);
const CLEAR_OBLIGATIONS = action("clear-obligations", [
  { kind: "removeThreat", target: eachObligation, amount: n(99) },
]);
const KILL_MINIONS = action("kill-minions", [{ kind: "dealDamage", target: eachMinion, amount: n(9) }]);
const FLIP_VILLAIN = action("flip-villain", [{ kind: "flipCard", target: { kind: "villain" } }]);
const ACTIONS = [
  REVEAL_TOP,
  THREAT_ON_ME,
  REMOVE_FROM_ME,
  REMOVE_FROM_MAIN,
  CLEAR_MINIONS,
  CLEAR_OBLIGATIONS,
  KILL_MINIONS,
  FLIP_VILLAIN,
];

/** "Threat cannot be removed from schemes." */
const NO_REMOVAL_RULE = stubAbility("no-removal.constant", {
  trigger: { kind: "constant", rules: [{ kind: "threatCannotBeRemoved", target: { categories: ["scheme"] } }] },
  effects: [],
});
const NO_REMOVAL = stubSupport({ id: "no-removal", cost: 0, abilities: [NO_REMOVAL_RULE.ref] });

const deps: EngineDeps = depsOf(MOVE_TO_SCHEME, NO_REMOVAL_RULE, ...ACTIONS.map((a) => a.ability));
const ENCOUNTER_CARDS: readonly AnyCard[] = [PAPARAZZI, HINDERING_MINION, PLAIN_MINION, CRISIS_SCHEME];
const ENCOUNTER: readonly CardId[] = [
  PAPARAZZI.id,
  HINDERING_MINION.id,
  PLAIN_MINION.id,
  CRISIS_SCHEME.id,
  ...copiesOf(PLAIN_MINION.id, 2),
];

function start(opts: { readonly mainScheme?: typeof MOJOMANIA; readonly villain?: VillainCard } = {}): GameState {
  return gameAtFirstTurn({
    deps,
    cards: [...ENCOUNTER_CARDS, NO_REMOVAL, TWO_FACED, ...ACTIONS.map((a) => a.card)],
    deck: [NO_REMOVAL.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 3))],
    encounter: [...ENCOUNTER, ...copiesOf(PLAIN_MINION.id, 20)],
    mainScheme: opts.mainScheme ?? QUIET_SCHEME,
    ...(opts.villain ? { villain: opts.villain } : {}),
  });
}

const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const threatOf = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const withThreat = (state: GameState, id: InstanceId, threat: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } },
});
/** The identity in hero form (it starts the game in alter-ego form). */
const inHeroForm = (state: GameState): GameState =>
  state.players[0]!.identity.form === "hero"
    ? state
    : driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
const placed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatPlaced" ? [{ on: e.schemeInstanceId, amount: e.amount }] : []));
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

describe("§3.59 Hinder X on any card type", () => {
  it("a revealed obligation with Hinder 10 enters play with 10 threat, in one placement", () => {
    const { events } = playFree(onTopOfEncounterDeck(start(), PAPARAZZI.id), deps, REVEAL_TOP.card.id);
    const obligation = events.find((e) => e.type === "encounterCardRevealed" && e.cardId === PAPARAZZI.id);
    expect(obligation?.type).toBe("encounterCardRevealed");
    const id = obligation?.type === "encounterCardRevealed" ? obligation.instanceId : null;
    expect(placed(events)).toEqual([{ on: id, amount: 10 }]);
  });

  it("a revealed minion with Hinder 2 enters play with 2 threat", () => {
    const { state, events } = playFree(onTopOfEncounterDeck(start(), HINDERING_MINION.id), deps, REVEAL_TOP.card.id);
    const minion = cardsInPlay(state).find((id) => mustInstance(state, id).cardId === HINDERING_MINION.id)!;
    expect(threatOf(state, minion)).toBe(2);
    expect(placed(events)).toEqual([{ on: minion, amount: 2 }]);
  });

  it("a card without hinder enters play with none", () => {
    const { events } = playFree(onTopOfEncounterDeck(start(), PLAIN_MINION.id), deps, REVEAL_TOP.card.id);
    expect(placed(events)).toEqual([]);
  });
});

describe("§3.59 a character holding threat is not a scheme (§4 Q34)", () => {
  it("card text places threat on a hero", () => {
    const { state, events } = playFree(start(), deps, THREAT_ON_ME.card.id);
    expect(threatOf(state, heroId(state))).toBe(3);
    expect(placed(events)).toEqual([{ on: heroId(state), amount: 3 }]);
  });

  it("a basic thwart cannot target it, and legal actions never offer it", () => {
    const hero0 = inHeroForm(start());
    const state = withThreat(withThreat(hero0, heroId(hero0), 3), hero0.mainScheme.instanceId, 2);
    const hero = heroId(state);
    const result = driveSession(startSession(state), deps, []).session;
    const legal = legalActions(result.state, P1, deps);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    const thwarts = legal.legal.filter((a) => a.action.kind === "basicThwart");
    expect(thwarts.length).toBeGreaterThan(0);
    for (const thwart of thwarts) expect(thwart.targets).not.toContain(hero);
    expect(() =>
      driveSession(startSession(state), deps, [
        { type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: hero },
      ]),
    ).toThrow(/not a scheme/);
  });

  it("'the scheme with the most threat' ignores it; 'the character with the most threat' finds it", () => {
    const state = withThreat(start(), heroId(start()), 5);
    const most = (categories: readonly ("scheme" | "character")[]): TargetRef => ({
      kind: "superlative",
      among: { kind: "each", query: { categories } },
      order: "highest",
      measure: { kind: "threat", of: { kind: "slot", slot: "candidate" } },
    });
    expect(resolveRef(state, most(["scheme"]), context)).toEqual([state.mainScheme.instanceId]);
    expect(resolveRef(state, most(["character"]), context)).toEqual([heroId(state)]);
  });

  it("villain phase step one places threat on the main scheme only, whatever a hero holds", () => {
    const endTurn = (state: GameState) =>
      driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]).session.state;
    const plain = endTurn(start());
    const held = endTurn(withThreat(start(), heroId(start()), 4));
    expect(threatOf(held, held.mainScheme.instanceId)).toBe(threatOf(plain, plain.mainScheme.instanceId));
    expect(threatOf(held, heroId(held))).toBe(4);
  });

  it("crisis does not stop card text removing threat from a hero", () => {
    const withCrisis = encounterCardInVillainArea(start(), CRISIS_SCHEME.id, 3).state;
    const base = withThreat(withThreat(withCrisis, heroId(withCrisis), 3), withCrisis.mainScheme.instanceId, 5);
    const fromHero = playFree(base, deps, REMOVE_FROM_ME.card.id);
    expect(threatOf(fromHero.state, heroId(base))).toBe(1);
    // The main scheme is protected by the crisis icon: the same card text aimed at it has no valid target.
    expect(() => playFree(base, deps, REMOVE_FROM_MAIN.card.id)).toThrow(/no valid target/);
  });

  it("'threat cannot be removed from schemes' does not protect a hero's threat", () => {
    const ruled = playerCardIntoPlay(start(), NO_REMOVAL.id).state;
    const base = withThreat(withThreat(ruled, heroId(ruled), 3), ruled.mainScheme.instanceId, 5);
    expect(threatOf(playFree(base, deps, REMOVE_FROM_ME.card.id).state, heroId(base))).toBe(1);
    expect(() => playFree(base, deps, REMOVE_FROM_MAIN.card.id)).toThrow(/no valid target/);
  });

  it("a minion or obligation brought to 0 threat is not defeated", () => {
    const engaged = minionEngagedWith(start(), PLAIN_MINION.id);
    const minion = engaged.id;
    const after = playFree(withThreat(engaged.state, minion, 3), deps, CLEAR_MINIONS.card.id);
    expect(threatOf(after.state, minion)).toBe(0);
    expect(cardsInPlay(after.state)).toContain(minion);
    expect(after.events.some((e) => e.type === "schemeDefeated" || e.type === "characterDefeated")).toBe(false);

    // An obligation in play (surgery: Paparazzi in p1's play area with 10 threat).
    const state = start();
    const deckId = state.encounterDeckOrder[0]!;
    const papa = state.encounterDecks[deckId]!.deck.find((id) => state.instances[id]?.cardId === PAPARAZZI.id)!;
    const inPlay: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: {
          ...state.encounterDecks[deckId]!,
          deck: state.encounterDecks[deckId]!.deck.filter((id) => id !== papa),
        },
      },
      players: state.players.map((p, i) => (i === 0 ? { ...p, playArea: [...p.playArea, papa] } : p)),
      instances: { ...state.instances, [papa]: { ...mustInstance(state, papa), threat: 10, faceup: true } },
    };
    const cleared = playFree(inPlay, deps, CLEAR_OBLIGATIONS.card.id);
    expect(threatOf(cleared.state, papa)).toBe(0);
    expect(cardsInPlay(cleared.state)).toContain(papa);
    expect(cleared.events.some((e) => e.type === "schemeDefeated")).toBe(false);
  });

  it("an outcome preview shows threat placed on a hero", () => {
    const { state, id } = giveCard(start(), P1, THREAT_ON_ME.card.id);
    const outcome = preview(
      state,
      { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null },
      deps,
    );
    const hero = outcome.counters.find((c) => c.instanceId === heroId(state));
    expect(hero?.before.threat).toBe(0);
    expect(hero?.after.threat).toBe(3);
  });
});

describe("§3.59 MojoMania 1B: a character's threat moves when it flips or leaves play", () => {
  const mojomania = (state: GameState): number => threatOf(state, state.mainScheme.instanceId);

  it("a hero changing form is a flip: the interrupt moves its threat to the scheme", () => {
    const state = withThreat(start({ mainScheme: MOJOMANIA }), heroId(start({ mainScheme: MOJOMANIA })), 3);
    const { session } = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]);
    expect(session.state.players[0]!.identity.form).not.toBe(state.players[0]!.identity.form);
    expect(threatOf(session.state, heroId(state))).toBe(0);
    expect(mojomania(session.state)).toBe(3);
  });

  it("a minion's defeat: its threat moves before it leaves play", () => {
    const engaged = minionEngagedWith(start({ mainScheme: MOJOMANIA }), PLAIN_MINION.id);
    const result = playFree(withThreat(engaged.state, engaged.id, 2), deps, KILL_MINIONS.card.id);
    expect(cardsInPlay(result.state)).not.toContain(engaged.id);
    expect(mojomania(result.state)).toBe(2);
    const removed = result.events.findIndex((e) => e.type === "threatRemoved" && e.schemeInstanceId === engaged.id);
    const left = result.events.findIndex((e) => e.type === "cardMoved" && e.instanceId === engaged.id);
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThan(removed);
  });

  it("a villain's flip moves the villain's threat", () => {
    const state = start({ mainScheme: MOJOMANIA, villain: TWO_FACED });
    const villain = activeVillain(state).instanceId;
    const result = playFree(withThreat(state, villain, 4), deps, FLIP_VILLAIN.card.id);
    expect(activeVillain(result.state).side).toBe("B");
    expect(threatOf(result.state, villain)).toBe(0);
    expect(mojomania(result.state)).toBe(4);
  });

  it("a character with no threat moves nothing, and the game replays", () => {
    const state = start({ mainScheme: MOJOMANIA });
    const { session } = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]);
    expect(mojomania(session.state)).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
