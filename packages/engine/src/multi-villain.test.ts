/**
 * docs/phase7-wave1.md §3.1 (several villains and the active villain) and §3.2 (an encounter deck per villain, and
 * discard routing), proven with synthetic cards shaped like The Wrecking Crew's Breakout.
 *
 * Sources: The Wrecking Crew insert, "The Active Villain", "Multiple Villains and Encounter Decks", "Signature Side
 * Schemes"; ruling, Jan 17, 2026 (5); RRG 1.8 "Guard" (p. 21), "Villain Defeat" (p. 47), "Encounter Deck" (p. 17),
 * "First Player" (p. 19).
 */

import { flat, type AnyCard, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { characterProfile, encounterDeckOf, mustInstance, mustPlayer, villainOf } from "./query.js";
import { moveCardsTo, selectCards } from "./resolve/cards.js";
import { canAttack, cardsInPlay } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import { legalActions } from "./legal.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubMinion, stubSideScheme, stubTreachery, stubVillain, stubMainScheme } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  HERO,
  seatIdentities,
  withEncounterPiles,
} from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const NAMES = ["wrecker", "thunderball", "piledriver", "bulldozer"] as const;
type Name = (typeof NAMES)[number];

/** Signature side scheme starting threat: Thunderball and Piledriver tie for the most once Wrecker is gone. */
const SIGNATURE_THREAT: Record<Name, number> = { wrecker: 1, thunderball: 3, piledriver: 3, bulldozer: 2 };

const goon = (name: Name) => stubMinion({ id: `goon-${name}`, atk: 0, sch: 0, hp: 2, boostIcons: 0 });
const signature = (name: Name) =>
  stubSideScheme({ id: `scheme-${name}`, startingThreat: SIGNATURE_THREAT[name], boostIcons: 0 });
const plainVillain = (name: Name, stages = 1): VillainCard =>
  stubVillain({ id: name, stages: Array.from({ length: stages }, () => ({ hp: flat(5), atk: 0, sch: 0 })) });

const GUARD = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 3, boostIcons: 0, keywords: [{ name: "guard" }] });
const SURGE = stubTreachery({ id: "surge-thunderball", boostIcons: 0, keywords: [{ name: "surge" }] });
const NEMESIS = stubMinion({
  id: "nemesis-minion",
  encounterSetIds: ["hero-nemesis"],
  atk: 0,
  sch: 0,
  hp: 2,
  boostIcons: 0,
});

/** Breakout 1A's setup, as data: "Put the … side schemes into play. Place the active counter on Wrecker." */
const BREAKOUT_SETUP = stubAbility("breakout.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
    { kind: "setActiveVillain", villain: { kind: "named", name: "wrecker" } },
  ],
});
const BREAKOUT = stubMainScheme({
  id: "breakout",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [BREAKOUT_SETUP.ref] },
  ],
});
const NO_SETUP_SCHEME = stubMainScheme({
  id: "no-setup",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

interface CrewOptions {
  readonly players?: number;
  readonly villains?: Partial<Record<Name, VillainCard>>;
  /** Every villain's first and last stage: the extreme challenge is `{ start: 0, last: 1 }`. */
  readonly stages?: { readonly start: number; readonly last: number };
  readonly abilities?: readonly StubAbility[];
  readonly extraCards?: readonly AnyCard[];
  readonly deckExtras?: Partial<Record<Name, readonly CardId[]>>;
  readonly includeIdentitySets?: boolean;
  /** Resolve Breakout 1A's setup (default true). */
  readonly setup?: boolean;
}

/** A Breakout-shaped game straight out of `createGame`, still on the mulligan choices. */
function crewAtMulligan(options: CrewOptions = {}): { readonly state: GameState; readonly deps: EngineDeps } {
  const deps = depsOf(BREAKOUT_SETUP, ...(options.abilities ?? []));
  const villainCards = NAMES.map(
    (name) => options.villains?.[name] ?? plainVillain(name, options.stages ? options.stages.last + 1 : 1),
  );
  const identities = seatIdentities(HERO, options.players ?? 1);
  const scheme = options.setup === false ? NO_SETUP_SCHEME : BREAKOUT;
  const config: GameSetupConfig = {
    seed: 99,
    cards: [
      ...DEFAULT_CARDS,
      ...identities,
      ...villainCards,
      ...NAMES.map(goon),
      ...NAMES.map(signature),
      scheme,
      GUARD,
      SURGE,
      ...(options.extraCards ?? []),
    ],
    villainCardId: villainCards[0]!.id,
    villains: NAMES.map((name, index) => ({
      villainCardId: villainCards[index]!.id,
      encounterDeck: [...Array.from({ length: 10 }, () => goon(name).id), ...(options.deckExtras?.[name] ?? [])],
      signatureSideSchemeCardId: signature(name).id,
      ...(options.stages ? { startStageIndex: options.stages.start, lastStageIndex: options.stages.last } : {}),
    })),
    mainSchemeCardId: scheme.id,
    encounterDeck: [],
    includeIdentitySets: options.includeIdentitySets ?? false,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return { state: result.state, deps };
}

/** Applies commands through a session, answering every choice with `defaultPick`, collecting events. */
function drive(
  session: GameSession,
  deps: EngineDeps,
  commands: readonly Command[] = [],
): { session: GameSession; events: GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  };
  const answerChoices = (): void => {
    for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = current.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(current.state),
      });
    }
  };
  answerChoices();
  for (const command of commands) {
    apply(command);
    answerChoices();
  }
  return { session: current, events };
}

/** Ends turns (and answers choices) until round `round` begins. */
function playUntilRound(
  session: GameSession,
  deps: EngineDeps,
  round: number,
): { session: GameSession; events: GameEvent[] } {
  let current = drive(session, deps);
  const events = [...current.events];
  for (let guard = 0; current.session.state.round < round && !current.session.state.outcome; guard++) {
    if (guard > 20) throw new Error("rounds did not advance");
    const step = current.session.state.step;
    if (step.kind !== "turn") throw new Error(`not at a turn: ${step.kind}`);
    current = drive(current.session, deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
    events.push(...current.events);
  }
  return { session: current.session, events };
}

const crew = (options: CrewOptions = {}) => {
  const { state, deps } = crewAtMulligan(options);
  const settled = drive(startSession(state), deps).session.state;
  return { state: settled, deps, villain: (name: Name) => villainIdOf(settled, name) };
};

const villainIdOf = (state: GameState, name: Name): InstanceId => {
  const found = state.villains.find((villain) => state.cardPool[villain.cardId]?.name === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};

const nameOf = (state: GameState, id: InstanceId): string => state.cardPool[mustInstance(state, id).cardId]?.name ?? id;

const ok = (state: GameState, deps: EngineDeps, command: Command) => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result;
};

const toHero = (state: GameState, deps: EngineDeps, player: PlayerId = p1): GameState =>
  ok(state, deps, { type: "changeForm", playerId: player }).state;

/** Test surgery: an out-of-play encounter card (deck or set aside) enters play engaged with `player`. */
function engage(
  state: GameState,
  cardName: string,
  player: PlayerId,
): { readonly state: GameState; readonly id: InstanceId } {
  const outOfPlay = [
    ...state.encounterDeckOrder.flatMap((deckId) => encounterDeckOf(state, deckId).deck),
    ...state.players.flatMap((p) => p.setAside),
  ];
  const id = outOfPlay.find((candidate) => nameOf(state, candidate) === cardName);
  if (!id) throw new Error(`no out-of-play ${cardName}`);
  const encounterDecks = Object.fromEntries(
    Object.entries(state.encounterDecks).map(([deckId, piles]) => [
      deckId,
      { ...piles, deck: piles.deck.filter((x) => x !== id) },
    ]),
  );
  return {
    id,
    state: {
      ...state,
      encounterDecks,
      players: state.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((x) => x !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, engagedWith: player, controllerId: null },
      },
    },
  };
}

/** Test surgery then a real basic attack: `target` is left exactly one hero hit from defeat, and p1's hero hits it. */
function strike(state: GameState, deps: EngineDeps, target: InstanceId, player: PlayerId = p1) {
  const identity = mustPlayer(state, player).identity.instanceId;
  const maxHp = characterProfile(state, target, deps)?.maxHp ?? 0;
  const primed: GameState = {
    ...state,
    instances: {
      ...state.instances,
      [identity]: { ...mustInstance(state, identity), exhausted: false },
      [target]: { ...mustInstance(state, target), damage: Math.max(0, maxHp - HERO.hero.atk) },
    },
  };
  return ok(primed, deps, {
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identity,
    targetInstanceId: target,
  });
}

const withActive = (state: GameState, id: InstanceId): GameState => ({ ...state, activeVillainId: id });

describe("§3.1 several villains, and the active villain", () => {
  it("setup creates each villain with its own encounter deck and a set-aside signature side scheme", () => {
    const { state } = crew({ setup: false });
    expect(state.villains.map((villain) => nameOf(state, villain.instanceId))).toEqual([...NAMES]);
    expect(state.activeVillainId).toBe(villainIdOf(state, "wrecker"));
    expect(state.encounterDeckOrder).toEqual(state.villains.map((villain) => villain.encounterDeckId));
    for (const villain of state.villains) {
      const name = nameOf(state, villain.instanceId);
      const piles = encounterDeckOf(state, villain.encounterDeckId);
      expect(piles.deck).toHaveLength(10);
      for (const id of piles.deck) {
        expect(nameOf(state, id)).toBe(`goon-${name}`);
        expect(mustInstance(state, id).home).toEqual({ kind: "encounterDeck", deckId: villain.encounterDeckId });
      }
      // Set aside and linked, out of play until a setup ability puts it in.
      expect(state.encounterSetAside).toContain(villain.signatureSideSchemeId);
      expect(cardsInPlay(state)).not.toContain(villain.signatureSideSchemeId);
    }
    // Every villain is in play at once.
    expect(cardsInPlay(state)).toEqual(expect.arrayContaining(state.villains.map((villain) => villain.instanceId)));
  });

  it("Breakout 1A's setup puts the four signature side schemes into play and places the active counter on Wrecker", () => {
    const { state, villain } = crew();
    expect(state.encounterSetAside).toEqual([]);
    for (const name of NAMES) {
      const scheme = villainOf(state, villain(name))?.signatureSideSchemeId as InstanceId;
      expect(state.villainArea).toContain(scheme);
      expect(mustInstance(state, scheme).threat).toBe(SIGNATURE_THREAT[name]);
    }
    expect(state.activeVillainId).toBe(villain("wrecker"));
  });

  it("villain phase step 2 activates only the active villain, once per player, and engaged minions still activate", () => {
    const { state, deps } = crewAtMulligan({ players: 2 });
    const { session, events } = playUntilRound(startSession(state), deps, 3);
    const wrecker = villainIdOf(session.state, "wrecker");
    const activations = events.filter(
      (e): e is Extract<GameEvent, { type: "enemyActivated" }> => e.type === "enemyActivated",
    );
    const byVillains = activations.filter((e) => villainOf(session.state, e.enemyInstanceId));
    // Two rounds × two players, every one of them Wrecker.
    expect(byVillains).toHaveLength(4);
    expect(byVillains.every((e) => e.enemyInstanceId === wrecker)).toBe(true);
    expect(new Set(byVillains.slice(0, 2).map((e) => e.playerId))).toEqual(new Set([p1, p2]));
    // Round 1's dealt goons came from Wrecker's deck and activated in round 2.
    const minions = activations.filter((e) => !villainOf(session.state, e.enemyInstanceId));
    expect(minions.map((e) => nameOf(session.state, e.enemyInstanceId))).toEqual(["goon-wrecker", "goon-wrecker"]);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("moving the active counter during one player's activations changes which villain activates against the next", () => {
    const handOff = stubAbility("wrecker.hand-off", {
      trigger: { kind: "response", forced: true, on: { on: "enemyScheme", selfIs: "source" } },
      effects: [{ kind: "setActiveVillain", villain: { kind: "named", name: "thunderball" } }],
    });
    const wreckerCard = stubVillain({
      id: "wrecker",
      stages: [{ hp: flat(5), atk: 0, sch: 0, abilities: [handOff.ref] }],
    });
    const { state, deps } = crewAtMulligan({ players: 2, villains: { wrecker: wreckerCard }, abilities: [handOff] });
    const { session, events } = playUntilRound(startSession(state), deps, 2);
    const [wrecker, thunderball] = [villainIdOf(session.state, "wrecker"), villainIdOf(session.state, "thunderball")];
    const villainActivations = events.filter(
      (e) => e.type === "enemyActivated" && villainOf(session.state, e.enemyInstanceId),
    );
    expect(
      villainActivations.map((e) =>
        e.type === "enemyActivated" ? [nameOf(session.state, e.enemyInstanceId), e.playerId] : null,
      ),
    ).toEqual([
      ["wrecker", p1],
      ["thunderball", p2],
    ]);
    expect(events).toContainEqual({ type: "activeVillainChanged", from: wrecker, to: thunderball, reason: "effect" });

    // §3.2: each boost card comes from the deck of the villain active when it is dealt, and step 3 deals from Thunderball's.
    const boosts = events.filter(
      (e): e is Extract<GameEvent, { type: "boostCardDealt" }> => e.type === "boostCardDealt",
    );
    expect(boosts.map((e) => nameOf(session.state, e.instanceId))).toEqual(["goon-wrecker", "goon-thunderball"]);
    const dealt = events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    expect(dealt.map((e) => (e.type === "cardMoved" ? nameOf(session.state, e.instanceId) : null))).toEqual([
      "goon-thunderball",
      "goon-thunderball",
    ]);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);

    // Replay deep-equal: the log alone reproduces the state.
    const replayed = replay(session.log, deps);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(session.state);
  });

  it("guard forbids attacking every villain, not only the active one (RRG 1.8 'Guard', p. 21)", () => {
    const { state, villain } = crew({ players: 2, deckExtras: { wrecker: [GUARD.id] } });
    const guarded = engage(state, "guard", p1);
    const p1Hero = mustPlayer(guarded.state, p1).identity.instanceId;
    const p2Hero = mustPlayer(guarded.state, p2).identity.instanceId;
    for (const name of NAMES) {
      expect(canAttack(guarded.state, p1Hero, villain(name))).toBe(false);
      expect(canAttack(guarded.state, p2Hero, villain(name))).toBe(true);
    }
    expect(canAttack(guarded.state, p1Hero, guarded.id)).toBe(true);
  });

  it("legalActions offers every undefeated villain as a basic attack target, and guard blocks every one", () => {
    const { state, deps, villain } = crew({ deckExtras: { wrecker: [GUARD.id] } });
    const hero = toHero(state, deps);
    const identity = mustPlayer(hero, p1).identity.instanceId;
    const basicAttackOf = (s: GameState) => {
      const actions = legalActions(s, p1, deps);
      if (actions.kind !== "turn") throw new Error(`not p1's turn: ${actions.kind}`);
      return [...actions.legal, ...actions.illegal].find(
        (a) => a.action.kind === "basicAttack" && a.action.instanceId === identity,
      );
    };
    const open = basicAttackOf(hero);
    expect(open && "targets" in open ? open.targets : []).toEqual(expect.arrayContaining(NAMES.map(villain)));

    const struck = strike(hero, deps, villain("bulldozer")).state;
    const afterDefeat = basicAttackOf(struck);
    expect(afterDefeat && "targets" in afterDefeat ? afterDefeat.targets : []).not.toContain(villain("bulldozer"));

    const guarded = engage(hero, "guard", p1).state;
    const blocked = basicAttackOf(guarded);
    const blockedIds = blocked && "blockedTargets" in blocked ? blocked.blockedTargets.map((b) => b.instanceId) : [];
    expect(blockedIds).toEqual(expect.arrayContaining(NAMES.map(villain)));
  });

  it("attacking a villain that isn't active is legal and leaves the counter where it is", () => {
    const { state, deps, villain } = crew();
    const hero = toHero(state, deps);
    const identity = mustPlayer(hero, p1).identity.instanceId;
    const after = ok(hero, deps, {
      type: "basicAttack",
      playerId: p1,
      attackerInstanceId: identity,
      targetInstanceId: villain("thunderball"),
    }).state;
    expect(mustInstance(after, villain("thunderball")).damage).toBe(HERO.hero.atk);
    expect(after.activeVillainId).toBe(villain("wrecker"));
  });

  it("defeating a villain that isn't active removes its side scheme from the game and leaves its encounter cards in play", () => {
    const { state, deps, villain } = crew();
    const engaged = engage(toHero(state, deps), "goon-thunderball", p1);
    const { state: after, events } = strike(engaged.state, deps, villain("thunderball"));
    const thunderball = villainOf(after, villain("thunderball"));
    expect(thunderball?.defeated).toBe(true);
    expect(after.outcome).toBeNull();
    expect(cardsInPlay(after)).not.toContain(villain("thunderball"));
    // Removed from the game, not defeated: no When Defeated window and no discard.
    const scheme = thunderball?.signatureSideSchemeId as InstanceId;
    expect(after.removedFromGame).toContain(scheme);
    expect(after.villainArea).not.toContain(scheme);
    expect(events.some((e) => e.type === "schemeDefeated")).toBe(false);
    expect(activeDiscards(after).flat()).not.toContain(scheme);
    // "Any encounter cards from that villain's deck that are in play remain in play."
    expect(mustPlayer(after, p1).playArea).toContain(engaged.id);
    expect(after.activeVillainId).toBe(villain("wrecker"));
  });

  it("defeating the active villain moves the counter to the villain whose side scheme has the most threat", () => {
    const { state, deps, villain } = crew();
    const hero = toHero(state, deps);
    const bulldozerScheme = villainOf(hero, villain("bulldozer"))?.signatureSideSchemeId as InstanceId;
    const leading: GameState = {
      ...hero,
      instances: { ...hero.instances, [bulldozerScheme]: { ...mustInstance(hero, bulldozerScheme), threat: 9 } },
    };
    const { state: after, events } = strike(leading, deps, villain("wrecker"));
    expect(after.pendingChoice).toBeNull();
    expect(after.activeVillainId).toBe(villain("bulldozer"));
    expect(events).toContainEqual({
      type: "activeVillainChanged",
      from: villain("wrecker"),
      to: villain("bulldozer"),
      reason: "activeVillainDefeated",
    });
  });

  it("a tie for the most threat is a first-player choice on the encounter side's behalf (firstPlayerTargets)", () => {
    const { state, deps, villain } = crew();
    const after = strike(toHero(state, deps), deps, villain("wrecker")).state;
    const choice = after.pendingChoice;
    expect(choice?.prompt.kind).toBe("chooseTarget");
    expect(choice?.authority).toBe("firstPlayerTargets");
    expect(choice?.playerId).toBe(after.firstPlayerId);
    expect(choice?.options.map((option) => option.optionId)).toEqual([villain("thunderball"), villain("piledriver")]);
    const chosen = ok(after, deps, {
      type: "resolveChoice",
      playerId: choice!.playerId,
      choiceId: choice!.choiceId,
      selectedOptionIds: [villain("piledriver")],
    });
    expect(chosen.state.activeVillainId).toBe(villain("piledriver"));
    expect(chosen.events).toContainEqual({
      type: "activeVillainChanged",
      from: villain("wrecker"),
      to: villain("piledriver"),
      reason: "activeVillainDefeated",
    });
  });

  it("the game is won only when the last villain is defeated", () => {
    const { state, deps, villain } = crew();
    let current = toHero(state, deps);
    for (const [index, name] of (["thunderball", "wrecker", "bulldozer", "piledriver"] as const).entries()) {
      const struck = strike(current, deps, villain(name)).state;
      current = drive(startSession(struck), deps).session.state;
      if (index < 3) expect(current.outcome).toBeNull();
    }
    expect(current.villains.every((villain) => villain.defeated)).toBe(true);
    expect(current.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });

  it("the extreme challenge: defeating version A is an ordinary stage advance to version B, and the side scheme stays", () => {
    const { state, deps, villain } = crew({ stages: { start: 0, last: 1 } });
    const { state: after, events } = strike(toHero(state, deps), deps, villain("thunderball"));
    const thunderball = villainOf(after, villain("thunderball"));
    expect(thunderball).toMatchObject({ stageIndex: 1, defeated: false });
    expect(mustInstance(after, villain("thunderball")).damage).toBe(0);
    expect(events).toContainEqual({ type: "villainStageAdvanced", stageIndex: 1, instanceId: villain("thunderball") });
    expect(after.villainArea).toContain(thunderball?.signatureSideSchemeId);
    const final = strike(after, deps, villain("thunderball")).state;
    expect(villainOf(final, villain("thunderball"))?.defeated).toBe(true);
  });
});

/** Every encounter discard pile, in deck order. */
const activeDiscards = (state: GameState): readonly (readonly InstanceId[])[] =>
  state.encounterDeckOrder.map((deckId) => encounterDeckOf(state, deckId).discard);

describe("§3.2 an encounter deck per villain, and discard routing", () => {
  it("boosting, dealing and surging all draw from the active villain's deck", () => {
    const { state, deps, villain } = crew({ deckExtras: { thunderball: [SURGE.id] } });
    const thunderballActive = withActive(state, villain("thunderball"));
    const piles = encounterDeckOf(
      thunderballActive,
      villainOf(thunderballActive, villain("thunderball"))!.encounterDeckId,
    );
    const surgeId = piles.deck.find((id) => nameOf(thunderballActive, id) === SURGE.id) as InstanceId;
    const goons = piles.deck.filter((id) => id !== surgeId);
    // Boost card, then the dealt card (the surge treachery), then the card its surge deals.
    const stacked = withEncounterPiles(thunderballActive, { deck: [goons[0]!, surgeId, ...goons.slice(1)] });
    const { events } = playUntilRound(startSession(stacked), deps, 2);
    const thunderballDeck = villainOf(stacked, villain("thunderball"))!.encounterDeckId;
    const drawnFrom = events.flatMap((e) =>
      e.type === "cardMoved" && e.from.kind === "encounterDeck" ? [e.from.deckId] : [],
    );
    expect(drawnFrom.length).toBe(3);
    expect(drawnFrom.every((deckId) => deckId === thunderballDeck)).toBe(true);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });

  it("a defeated minion from Wrecker's deck goes to Wrecker's discard pile while Thunderball is active", () => {
    const { state, deps, villain } = crew();
    const engaged = engage(withActive(toHero(state, deps), villain("thunderball")), "goon-wrecker", p1);
    const after = drive(startSession(strike(engaged.state, deps, engaged.id).state), deps).session.state;
    const [wreckerDiscard, thunderballDiscard] = activeDiscards(after);
    expect(wreckerDiscard).toContain(engaged.id);
    expect(thunderballDiscard).toEqual([]);
  });

  it("a nemesis minion, which has no encounter deck of its own, goes to the active villain's discard (ruling, Jan 17, 2026 (5))", () => {
    const { state, deps, villain } = crew({ includeIdentitySets: true, extraCards: [NEMESIS] });
    const engaged = engage(withActive(toHero(state, deps), villain("piledriver")), NEMESIS.id, p1);
    expect(mustInstance(engaged.state, engaged.id).home).toEqual({ kind: "activeEncounterDeck" });
    const after = drive(startSession(strike(engaged.state, deps, engaged.id).state), deps).session.state;
    expect(activeDiscards(after)).toEqual([[], [], [engaged.id], []]);
  });

  it("emptying one villain's deck reshuffles only that deck and adds exactly one acceleration token", () => {
    const { state, deps } = crew();
    const wreckerPiles = encounterDeckOf(state, state.encounterDeckOrder[0]!);
    const emptied = withEncounterPiles(state, { deck: [], discard: wreckerPiles.deck });
    const untouched = state.encounterDeckOrder.slice(1).map((deckId) => encounterDeckOf(emptied, deckId));
    const { session, events } = playUntilRound(startSession(emptied), deps, 2);
    const shuffles = events.filter(
      (e) => e.type === "deckShuffled" && (e.zone.kind === "encounterDeck" || e.zone.kind === "encounterDiscard"),
    );
    expect(shuffles).toHaveLength(1);
    expect(shuffles[0]).toMatchObject({ zone: { kind: "encounterDeck", deckId: state.encounterDeckOrder[0] } });
    expect(events.filter((e) => e.type === "accelerationTokenAdded")).toHaveLength(1);
    expect(session.state.mainScheme.accelerationTokens).toBe(1);
    expect(state.encounterDeckOrder.slice(1).map((deckId) => encounterDeckOf(session.state, deckId))).toEqual(
      untouched,
    );
  });

  it("'the encounter deck' in selectors and destinations is the active villain's; `deckOf` names another villain's deck", () => {
    const { state, deps, villain } = crew();
    const active = withActive(state, villain("thunderball"));
    const ctx = createCtx(active, deps);
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {} };
    const [, thunderballDeck, , bulldozerDeck] = active.encounterDeckOrder.map(
      (deckId) => encounterDeckOf(active, deckId).deck,
    );
    expect(selectCards(ctx, { kind: "encounter", zones: ["deck"] }, context)).toEqual(thunderballDeck);
    expect(
      selectCards(ctx, { kind: "encounter", zones: ["deck"], deckOf: { kind: "named", name: "bulldozer" } }, context),
    ).toEqual(bulldozerDeck);

    // "Shuffle it into the encounter deck" (ruling, Jan 17, 2026 (5): into the active villain's), keeping its home.
    const stray = bulldozerDeck![0]!;
    moveCardsTo(ctx, [stray], "encounterDeckShuffle");
    expect(encounterDeckOf(ctx.state, active.encounterDeckOrder[1]!).deck).toContain(stray);
    expect(encounterDeckOf(ctx.state, active.encounterDeckOrder[3]!).deck).not.toContain(stray);
    expect(mustInstance(ctx.state, stray).home).toEqual({
      kind: "encounterDeck",
      deckId: active.encounterDeckOrder[3],
    });
  });
});
