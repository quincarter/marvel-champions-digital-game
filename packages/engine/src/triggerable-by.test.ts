/**
 * docs/phase7-wave6.md §3.11: who may trigger an ability (`trigger.triggerableBy`). Synthetic cards shaped like X-Mansion
 * (`mut_gen` 32049: "Alter-Ego Action: Exhaust X-Mansion → … Any player whose alter-ego has the [MUTANT] trait may
 * trigger this ability.") and Protect the Senator (32065b, an encounter environment: "Hero Response: After your hero
 * defends against an attack …, spend 2 resources of any type → ready your hero. Only the player who controls Robert
 * Kelly can trigger this ability.").
 *
 * Absent, today's rule holds: the controller, or the player the event is about on an encounter card (RRG 1.8
 * "Ability", p. 4). Present, every player it names is offered the ability and is "you" while it resolves.
 */

import { trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import { createGame } from "./setup.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEnvironment, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  HERO,
  MAIN_SCHEME,
  seatIdentities,
  VILLAIN,
} from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const P3 = playerId("p3");
const MUTANT = trait("Mutant");
const one = { kind: "const", value: 1 } as const;
const you: PlayerRef = { kind: "controller" };
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** A game past setup at p1's first turn, `players` seats with the given alter-ego / hero traits. */
function gameWith(options: {
  readonly deps: EngineDeps;
  readonly cards: readonly AnyCard[];
  readonly encounter: readonly CardId[];
  readonly deck?: readonly CardId[];
  readonly seats: readonly { readonly alterEgo?: readonly string[]; readonly hero?: readonly string[] }[];
}): GameState {
  const identities = seatIdentities(HERO, options.seats.length).map((identity, seat) => ({
    ...identity,
    alterEgo: { ...identity.alterEgo, traits: (options.seats[seat]?.alterEgo ?? []).map(trait) },
    hero: { ...identity.hero, traits: (options.seats[seat]?.hero ?? []).map(trait) },
  }));
  const result = createGame(
    {
      seed: 7,
      cards: [...DEFAULT_CARDS.filter((card) => card.id !== HERO.id), ...identities, ...options.cards],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: options.encounter,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...(options.deck ?? [])],
      })),
    },
    options.deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), options.deps).session.state;
}

const endTurn = (playerId: PlayerId) => ({ type: "endTurn", playerId }) as const;
const toHero = (playerId: PlayerId) => ({ type: "changeForm", playerId }) as const;

function expectReplays(session: GameSession, deps: EngineDeps): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

// ---------------------------------------------------------------------------
// X-Mansion: an Alter-Ego Action any player whose alter-ego has a trait may trigger
// ---------------------------------------------------------------------------

const MANSION_ACTION = stubAbility("mansion.action", {
  trigger: {
    kind: "action",
    form: "alterEgo",
    triggerableBy: {
      kind: "where",
      predicate: { kind: "hasTrait", of: { kind: "identityOf", player: { kind: "scoped" } }, trait: MUTANT },
    },
  },
  limit: { count: 1, period: "round" },
  effects: [{ kind: "draw", player: you, amount: one }],
});
const MANSION = stubSupport({ id: "mansion", cost: 0, abilities: [MANSION_ACTION.ref] });
const mansionDeps = depsOf(MANSION_ACTION);

/**
 * p1 controls the Mansion and is no Mutant; p2 is a Mutant on both faces; p3 is a Mutant only as a hero. p4's alter-ego
 * is a Mutant too, so a second matching player can find the card's limit already spent.
 */
function mansionGame(): { readonly state: GameState; readonly mansion: InstanceId } {
  const state = gameWith({
    deps: mansionDeps,
    cards: [MANSION, BLANK],
    encounter: copiesOf(BLANK.id, 30),
    deck: [MANSION.id],
    seats: [{}, { alterEgo: ["Mutant"], hero: ["Mutant"] }, { hero: ["Mutant"] }, { alterEgo: ["Mutant"] }],
  });
  const placed = playerCardIntoPlay(state, MANSION.id, P1);
  return { state: placed.state, mansion: placed.id };
}

/** How `legalActions` lists the Mansion's action for `player`: "legal", the illegal reason, or "absent". */
function mansionOffer(state: GameState, player: PlayerId, mansion: InstanceId): string {
  const actions = legalActions(state, player, mansionDeps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return actions.kind;
  const ours = (ref: { readonly kind: string; readonly instanceId?: InstanceId; readonly abilityId?: string }) =>
    ref.kind === "useAbility" && ref.instanceId === mansion && ref.abilityId === MANSION_ACTION.ref.id;
  if (actions.legal.some((a) => ours(a.action))) return "legal";
  const illegal = actions.illegal.find((a) => ours(a.action));
  return illegal ? illegal.reason : "absent";
}

const useMansion = (player: PlayerId, mansion: InstanceId) =>
  ({
    type: "useAbility",
    playerId: player,
    cardInstanceId: mansion,
    abilityId: MANSION_ACTION.ref.id,
    payment: [],
  }) as const;

describe("§3.11 an action any player matching a query may trigger (X-Mansion)", () => {
  it("is not offered to its non-matching controller, and is refused if they try", () => {
    const { state, mansion } = mansionGame();
    expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
    expect(mansionOffer(state, P1, mansion)).toBe("absent");
    const tried = applyCommand(state, useMansion(P1, mansion), mansionDeps);
    expect(tried.ok).toBe(false);
    if (!tried.ok) expect(tried.error.message).toBe("you may not trigger that ability");
  });

  it("is offered to another player whose alter-ego matches, who resolves it as 'you'; the limit is the card's", () => {
    const { state, mansion } = mansionGame();
    // During p1's turn (RRG 1.8 "Action", p. 6: "or by request during other players' turns"; the command is the
    // offer, docs/phase7-wave7.md §4.1): p2 and p4 are offered it, p3 (a Mutant only as a hero) is not.
    const p1Turn = startSession(state);
    expect(legalActions(state, P2, mansionDeps).kind).toBe("notYourTurn");
    expect([P2, P3, playerId("p4")].map((p) => mansionOffer(state, p, mansion))).toEqual(["legal", "absent", "legal"]);
    const hands = (s: GameState) => [P1, P2, P3, playerId("p4")].map((p) => mustPlayer(s, p).hand.length);
    const before = hands(state);
    const used = driveSession(p1Turn, mansionDeps, [useMansion(P2, mansion)]);
    expect(used.session.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
    // "(Limit once per round)" is the card's: p4, also offered it a moment ago, now finds it spent, still on p1's turn.
    expect(mansionOffer(used.session.state, playerId("p4"), mansion)).toBe("limit_reached");
    // p2 drew the card, not the Mansion's controller.
    expect(hands(used.session.state)).toEqual([before[0], before[1]! + 1, before[2], before[3]]);
    expect(used.events).toContainEqual(
      expect.objectContaining({ type: "abilityResolved", instanceId: mansion, controllerId: P2 }),
    );
    // Still p1's card.
    expect(mustInstance(used.session.state, mansion).controllerId).toBe(P1);
    expect(mansionOffer(used.session.state, P2, mansion)).toBe("limit_reached");
    // p3: a Mutant only on the hero face, so not while in alter-ego form.
    const p3Turn = driveSession(used.session, mansionDeps, [endTurn(P1), endTurn(P2)]).session;
    expect(mansionOffer(p3Turn.state, P3, mansion)).toBe("absent");
    // p4 matches, but "(Limit once per round)" counts the card's uses, whoever made them.
    const p4Turn = driveSession(p3Turn, mansionDeps, [endTurn(P3)]).session;
    expect(mansionOffer(p4Turn.state, playerId("p4"), mansion)).toBe("limit_reached");
    expectReplays(p4Turn, mansionDeps);
  });

  it("applies its Alter-Ego form gate to the triggering player", () => {
    const { state, mansion } = mansionGame();
    // During p1's turn the gate reads p2, an alter-ego, not p1 turned hero.
    const p1Hero = driveSession(startSession(state), mansionDeps, [toHero(P1)]).session.state;
    expect(mustPlayer(p1Hero, P1).identity.form).toBe("hero");
    expect(mansionOffer(p1Hero, P2, mansion)).toBe("legal");
    const hero = driveSession(startSession(state), mansionDeps, [endTurn(P1), toHero(P2)]).session.state;
    expect(mustPlayer(hero, P2).identity.form).toBe("hero");
    expect(mansionOffer(hero, P2, mansion)).toBe("wrong_form");
    const tried = applyCommand(hero, useMansion(P2, mansion), mansionDeps);
    expect(tried.ok).toBe(false);
    if (!tried.ok) expect(tried.error.code).toBe("wrong_form");
  });
});

// ---------------------------------------------------------------------------
// Protect the Senator: a Hero Response on an encounter environment only one card's controller may trigger
// ---------------------------------------------------------------------------

const SENATOR = stubAlly({ id: "senator", cost: 0, atk: 0, thw: 0, hp: 5 });

/** "Hero Response: After your hero defends …, ready your hero." */
function senatorResponse(id: string, triggerableBy?: PlayerRef): StubAbility {
  const trigger: AbilityTriggerSpec = {
    kind: "response",
    forced: false,
    form: "hero",
    on: { on: "defended", playerIs: "controller", targetIs: { categories: ["hero"] } },
    ...(triggerableBy ? { triggerableBy } : {}),
  };
  const definition: AbilityDefinition = {
    trigger,
    effects: [{ kind: "ready", target: { kind: "identityOf", player: you } }],
  };
  return stubAbility(id, definition);
}

const ONLY_SENATOR = senatorResponse("protect.response", {
  kind: "controllerOf",
  target: { kind: "named", name: "senator" },
});
const ANY_DEFENDER = senatorResponse("anyone.response");
const PROTECT = stubEnvironment({ id: "protect", abilities: [ONLY_SENATOR.ref] });
const ANYONE = stubEnvironment({ id: "anyone", abilities: [ANY_DEFENDER.ref] });
/** "Response: After a hero defends, place a rally counter on your hero. (Limit once per round.) (Any player may…)" */
const RALLY_RESPONSE = stubAbility("rally.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "defended", targetIs: { categories: ["hero"] } },
    triggerableBy: { kind: "each" },
  },
  limit: { count: 1, period: "round" },
  effects: [{ kind: "addCounters", target: { kind: "identityOf", player: you }, counterType: "rally", amount: one }],
});
const RALLY = stubEnvironment({ id: "rally", abilities: [RALLY_RESPONSE.ref] });

interface Offer {
  readonly playerId: PlayerId;
  readonly options: readonly string[];
}

/**
 * Both players in hero form, p2 controlling the senator and `environment` in play; the round's villain attacks are
 * defended by each attacked hero, and every response offered is taken.
 */
function senatorRound(environment: CardId, ability: StubAbility) {
  const deps = depsOf(ability);
  const start = gameWith({
    deps,
    cards: [PROTECT, ANYONE, RALLY, SENATOR, BLANK],
    encounter: [PROTECT.id, ANYONE.id, RALLY.id, ...copiesOf(BLANK.id, 30)],
    deck: [SENATOR.id],
    seats: [{}, {}],
  });
  const env = encounterCardInVillainArea(start, environment);
  const senator = playerCardIntoPlay(env.state, SENATOR.id, P2);
  const offers: Offer[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return [mustPlayer(state, choice.playerId).identity.instanceId];
    if (choice?.prompt.kind === "chooseTriggers") {
      const options = choice.options.map((o) => o.optionId);
      offers.push({ playerId: choice.playerId, options });
      return options;
    }
    return defaultPick(state);
  };
  const run = driveSession(startSession(senator.state), deps, [toHero(P1), endTurn(P1), toHero(P2), endTurn(P2)], pick);
  return { run, offers, envId: env.id, deps };
}

const exhausted = (state: GameState, player: PlayerId): boolean =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).exhausted;

describe("§3.11 a response only the controller of a named card may trigger (Protect the Senator)", () => {
  it("is offered to the senator's controller after their hero defends, and to nobody else", () => {
    const { run, offers, envId, deps } = senatorRound(PROTECT.id, ONLY_SENATOR);
    const state = run.session.state;
    expect(state.round).toBe(2);
    expect(offers).toEqual([{ playerId: P2, options: [`${envId}:${ONLY_SENATOR.ref.id}`] }]);
    expect(run.events).toContainEqual(
      expect.objectContaining({ type: "abilityResolved", instanceId: envId, controllerId: P2 }),
    );
    // p2's hero was readied ("ready your hero" reads the triggering player); p1's stays exhausted from defending.
    expect(exhausted(state, P1)).toBe(true);
    expect(exhausted(state, P2)).toBe(false);
    expectReplays(run.session, deps);
  });

  it("absent `triggerableBy`, today's rule: an encounter card's response goes to the player the event is about", () => {
    const { run, offers, envId } = senatorRound(ANYONE.id, ANY_DEFENDER);
    const option = `${envId}:${ANY_DEFENDER.ref.id}`;
    expect(offers).toEqual([
      { playerId: P1, options: [option] },
      { playerId: P2, options: [option] },
    ]);
    expect(exhausted(run.session.state, P1)).toBe(false);
    expect(exhausted(run.session.state, P2)).toBe(false);
  });

  it("offered to every player it names in one window, it resolves once: the second pick finds the limit spent", () => {
    const { run, offers, envId, deps } = senatorRound(RALLY.id, RALLY_RESPONSE);
    const option = `${envId}:${RALLY_RESPONSE.ref.id}`;
    // p1's defense opens the window, offered to both players; p2's defense finds the limit spent.
    expect(offers).toEqual([
      { playerId: P1, options: [option] },
      { playerId: P2, options: [option] },
    ]);
    const rally = (player: PlayerId) =>
      mustInstance(run.session.state, mustPlayer(run.session.state, player).identity.instanceId).counters.rally;
    expect(rally(P1)).toBe(1);
    expect(rally(P2)).toBeUndefined();
    expect(run.events.filter((e) => e.type === "abilityResolved" && e.instanceId === envId)).toHaveLength(1);
    expectReplays(run.session, deps);
  });
});

describe("§3.11 absent `triggerableBy`: a player card's action stays its controller's", () => {
  const OWN_ACTION = stubAbility("own.action", { trigger: { kind: "action" }, effects: [] });
  const OWN = stubSupport({ id: "own", cost: 0, abilities: [OWN_ACTION.ref] });
  const deps = depsOf(OWN_ACTION);

  it("is offered to p1 who controls it, not to p2, and refused to p2", () => {
    const state = gameWith({
      deps,
      cards: [OWN, BLANK],
      encounter: copiesOf(BLANK.id, 30),
      deck: [OWN.id],
      seats: [{}, {}],
    });
    const placed = playerCardIntoPlay(state, OWN.id, P1);
    const listed = (s: GameState, player: PlayerId) => {
      const actions = legalActions(s, player, deps);
      if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return actions.kind;
      return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === placed.id)
        ? "legal"
        : "absent";
    };
    expect(listed(placed.state, P1)).toBe("legal");
    // Not during p1's turn either: an Action there is still on a card the player controls (RRG 1.8 "Action", p. 6).
    expect(listed(placed.state, P2)).toBe("absent");
    const offTurn = applyCommand(
      placed.state,
      { type: "useAbility", playerId: P2, cardInstanceId: placed.id, abilityId: OWN_ACTION.ref.id, payment: [] },
      deps,
    );
    expect(!offTurn.ok && offTurn.error.message).toBe("you do not control that card");
    const p2Turn = driveSession(startSession(placed.state), deps, [endTurn(P1)]).session.state;
    expect(listed(p2Turn, P2)).toBe("absent");
    const tried = applyCommand(
      p2Turn,
      { type: "useAbility", playerId: P2, cardInstanceId: placed.id, abilityId: OWN_ACTION.ref.id, payment: [] },
      deps,
    );
    expect(tried.ok).toBe(false);
    if (!tried.ok) expect(tried.error.message).toBe("you do not control that card");
  });
});
