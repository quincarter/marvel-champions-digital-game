/**
 * The order in which a revealed minion resolves (the owner's answers of 2026-10-12, docs/phase7-wave10.md §4.0:
 * 30B, 32B, 33A, 34B; the survey is docs/phase7-wave10-q30-impact.md), proven with synthetic cards.
 *
 * RRG 1.8 "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the quickstrike keyword
 * resolves after any 'When Revealed' abilities on that minion are resolved." "Teamwork (Trait)" (p. 43): the same
 * sentence. "Reveal" (p. 38): "Responses (both forced and non-forced) to any step of the revealing of an encounter
 * card are not resolved until after all steps of the reveal process have been completed." FAQ "Widow's Bite (#10)"
 * (p. 60): "Keywords have timing priority over 'Response' abilities, so Quickstrike resolves first." "Toughness"
 * (p. 45) is a Forced Response to entering play, so on a revealed card it waits for the end of the reveal (RRG v1.8
 * p.38; owner decision 2026-10-16 (audit finding 18), superseding 33A, which kept it as the minion entered play).
 * "Forced" (p. 20): the
 * first player orders forced abilities that would initiate at the same moment (34B). "When Revealed Abilities" (p. 48):
 * a card put into play without being revealed resolves no When Revealed, and its quickstrike answers the engagement
 * at once (p. 36, p. 18).
 *
 * So one reveal runs: faceup, enters play (interrupts), When Revealed (the surge deal last among them: RRG v1.8 p.42;
 * owner decision 2026-10-16 (audit finding 16)), toughness, quickstrike and teamwork, the responses to everything that
 * happened during it and to it being revealed, then those to it engaging.
 *
 * The second list of 2026-10-12: 35B, the "Reveal" sentence holds the enters-play responses of every revealed card
 * that enters play (a side scheme, an attachment, an environment), not only a minion's; 36B, teamwork activates
 * against "the player it is engaged with" (p. 43) as it resolves, so a When Revealed that moved the minion moves the
 * activation with it, while quickstrike stays on the player the reveal engaged.
 */

import { flat, trait, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  defaultPick,
  DEFAULT_DECK,
  giveCard,
  newGame,
  runWith,
  settle,
  settleUntil,
  withEncounterPiles,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const CREW = trait("CREW");
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
/** A counter on the main scheme: every mark lands on one card, so the log orders them. */
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: { kind: "const", value: 1 },
});
const whenRevealed = (id: string, ...effects: EffectSpec[]): AbilityReference =>
  ability(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects: [...effects, mark("revealed")] });
const quickstrike = { name: "quickstrike" } as const;
const teamwork = { name: "teamwork", sharedTrait: CREW } as const;

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** Quickstrike, ATK 2, a When Revealed that only leaves a mark. */
const SENTRY = stubMinion({
  id: "sentry",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [whenRevealed("sentry")],
});
/** Quickstrike, ATK 1, +1 ATK for each armed counter on it. "When Revealed: place 2 armed counters here." */
const ARMED = stubMinion({
  id: "armed",
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [
    whenRevealed("armed", {
      kind: "addCounters",
      target: self,
      counterType: "armed",
      amount: { kind: "const", value: 2 },
    }),
    ability("armed.constant", {
      trigger: {
        kind: "constant",
        modifiers: [
          { stat: "atk", amount: { kind: "counters", of: self, counterType: "armed" }, target: { self: true } },
        ],
      },
      effects: [],
    }),
  ],
});
/** Quickstrike. "When Revealed: exhaust your identity." */
const PINNER = stubMinion({
  id: "pinner",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [whenRevealed("pinner", { kind: "exhaust", target: { kind: "identityOf", player: you } })],
});
/** Quickstrike. "When Revealed: you are stunned." (Hellcat's shape.) */
const STUNNER = stubMinion({
  id: "stunner",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [
    whenRevealed("stunner", { kind: "giveStatus", target: { kind: "identityOf", player: you }, status: "stunned" }),
  ],
});
/** Quickstrike. "When Revealed: discard this minion." */
const VANISH = stubMinion({
  id: "vanish",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [whenRevealed("vanish", { kind: "discardFromPlay", target: self })],
});
/** Quickstrike. "When Revealed: the other player engages this minion." */
const TURNCOAT = stubMinion({
  id: "turncoat",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [whenRevealed("turncoat", { kind: "engage", minion: self, player: { kind: "id", playerId: p2 } })],
});
/** Quickstrike. "When Revealed: change to alter-ego form." */
const COWER = stubMinion({
  id: "cower",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike],
  abilities: [whenRevealed("cower", { kind: "changeForm", player: you, to: "alterEgo" })],
});
/** Quickstrike, toughness. "When Revealed: deal 1 damage to this minion." */
const SHELL = stubMinion({
  id: "shell",
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike, { name: "toughness" }],
  abilities: [whenRevealed("shell", { kind: "dealDamage", target: self, amount: { kind: "const", value: 1 } })],
});
/** Quickstrike, teamwork (CREW), surge, ATK 2. */
const CAPTAIN = stubMinion({
  id: "captain",
  traits: [CREW],
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike, teamwork, { name: "surge" }],
  abilities: [whenRevealed("captain")],
});
/** Teamwork (CREW) only, with a When Revealed. */
const DECKHAND = stubMinion({
  id: "deckhand",
  traits: [CREW],
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [teamwork],
  abilities: [whenRevealed("deckhand")],
});
/** Teamwork (CREW), ATK 1. "When Revealed: the other player engages this minion." */
const DEFECTOR = stubMinion({
  id: "defector",
  traits: [CREW],
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [teamwork],
  abilities: [whenRevealed("defector", { kind: "engage", minion: self, player: { kind: "id", playerId: p2 } })],
});
/** Quickstrike and teamwork (CREW), ATK 2. "When Revealed: the other player engages this minion." */
const MUTINEER = stubMinion({
  id: "mutineer",
  traits: [CREW],
  atk: 2,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [quickstrike, teamwork],
  abilities: [whenRevealed("mutineer", { kind: "engage", minion: self, player: { kind: "id", playerId: p2 } })],
});
/** A CREW minion to stand beside them. */
const MATE = stubMinion({ id: "mate", traits: [CREW], atk: 0, sch: 0, hp: 5, boostIcons: 0 });

/** Widow's Bite's shape: "Response: After a minion enters play engaged with you, …" (forced here, so it always fires). */
const BITE = stubSupport({
  id: "bite",
  cost: 0,
  abilities: [
    ability("bite.response", {
      trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [mark("bite")],
    }),
  ],
});
/** "Forced Response: After you engage a minion, …" */
const GREET = stubSupport({
  id: "greet",
  cost: 0,
  abilities: [
    ability("greet.response", {
      trigger: { kind: "response", forced: true, on: { on: "minionEngaged", playerIs: "controller" } },
      effects: [mark("greet")],
    }),
  ],
});
/** "Interrupt: When a minion would enter play, …" */
const BRACE = stubSupport({
  id: "brace",
  cost: 0,
  abilities: [
    ability("brace.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [mark("brace")],
    }),
  ],
});
/** An optional "Interrupt: When a minion would enter play, …": a place for a game to wait mid-reveal. */
const HALT = stubSupport({
  id: "halt",
  cost: 0,
  abilities: [
    ability("halt.interrupt", {
      trigger: { kind: "interrupt", forced: false, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [mark("halt")],
    }),
  ],
});
/** "Interrupt: When an encounter card is revealed, cancel its 'When Revealed' effects." */
const SENSE = stubSupport({
  id: "sense",
  cost: 0,
  abilities: [
    ability("sense.interrupt", {
      trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
      effects: [{ kind: "cancelWhenRevealed" }],
    }),
  ],
});
/** "Interrupt: When an encounter card is revealed, cancel the effects of that card and discard it." */
const WARD = stubSupport({
  id: "ward",
  cost: 0,
  abilities: [
    ability("ward.interrupt", {
      trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
      effects: [{ kind: "cancelRevealedCard" }],
    }),
  ],
});
/** "Reveal the top card of the encounter deck." */
const SCOUT = stubEvent({
  id: "scout",
  cost: 0,
  abilities: [
    ability("scout.action", {
      trigger: { kind: "action" },
      effects: [{ kind: "revealEncounterCard", player: you }],
    }),
  ],
});
/** "Put the top card of the encounter deck into play engaged with you." */
const AMBUSH = stubEvent({
  id: "ambush",
  cost: 0,
  abilities: [
    ability("ambush.action", {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "m",
          cards: { kind: "encounter", zones: ["deck"], filter: { categories: ["minion"] } },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: you },
      ],
    }),
  ],
});

/** A side scheme, an attachment (on the villain) and an environment, each with a When Revealed that leaves a mark. */
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0, abilities: [whenRevealed("plot")] });
const GEAR = stubAttachment({ id: "gear", attachesTo: { kind: "villain" }, abilities: [whenRevealed("gear")] });
const HAZE = stubEnvironment({ id: "haze", abilities: [whenRevealed("haze")] });
const NOT_MINIONS: readonly AnyCard[] = [PLOT, GEAR, HAZE];
const notMinion = { categories: ["sideScheme", "attachment", "environment"] } as const;
/** "Forced Response: After a side scheme, attachment or environment enters play, …" */
const WATCH = stubSupport({
  id: "watch",
  cost: 0,
  abilities: [
    ability("watch.response", {
      trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: notMinion } },
      effects: [mark("watch")],
    }),
  ],
});
/** "Forced Interrupt: When a side scheme, attachment or environment would enter play, …" */
const FORESEE = stubSupport({
  id: "foresee",
  cost: 0,
  abilities: [
    ability("foresee.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", targetIs: notMinion } },
      effects: [mark("foresee")],
    }),
  ],
});
/** "Put the top side scheme of the encounter deck into play." */
const PLANT = stubEvent({
  id: "plant",
  cost: 0,
  abilities: [
    ability("plant.action", {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "s",
          cards: { kind: "encounter", zones: ["deck"], filter: { categories: ["sideScheme"] } },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "s" }, controller: you },
      ],
    }),
  ],
});

const MINIONS: readonly AnyCard[] = [
  SENTRY,
  ARMED,
  PINNER,
  STUNNER,
  VANISH,
  TURNCOAT,
  COWER,
  SHELL,
  CAPTAIN,
  DECKHAND,
  DEFECTOR,
  MUTINEER,
  MATE,
];
const PLAYER_CARDS: readonly AnyCard[] = [BITE, GREET, BRACE, HALT, SENSE, WARD, SCOUT, AMBUSH, WATCH, FORESEE, PLANT];
const deps: EngineDeps = depsOf(...abilities);

/**
 * A game on p1's turn, p1 (and p2, with two players) in hero form, with `top` on top of the encounter deck and `inPlay`
 * faceup in p1's play area engaged with p1 (test surgery, so nothing depends on the shuffle).
 */
function game(top: AnyCard, inPlay: readonly AnyCard[] = [], players = 1): GameState {
  const start = newGame({
    players,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [...MINIONS, ...NOT_MINIONS, ...PLAYER_CARDS, BLANK],
    encounterDeck: [top.id, ...inPlay.map((card) => card.id), ...copies(BLANK.id, 15)],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((card) => card.id)],
  });
  let deck = [...activeEncounterDeck(start).deck];
  const take = (card: AnyCard): InstanceId => {
    const id = deck.find((i) => start.instances[i]?.cardId === card.id) as InstanceId;
    deck = deck.filter((i) => i !== id);
    return id;
  };
  const topId = take(top);
  const inPlayIds = inPlay.map(take);
  const surgery = withEncounterPiles(start, { deck: [topId, ...deck] });
  return {
    ...surgery,
    players: surgery.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const },
      playArea: p.playerId === p1 ? [...p.playArea, ...inPlayIds] : p.playArea,
    })),
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

const playCommand = (state: GameState, card: AnyCard) => {
  const given = giveCard(state, p1, card.id);
  return {
    state: given.state,
    command: {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    } as const,
  };
};
function play(state: GameState, card: AnyCard, pick: (state: GameState) => readonly string[] = defaultPick) {
  const { state: given, command } = playCommand(state, card);
  return runCommandsPicking(given, deps, pick, command);
}
const withSupports = (state: GameState, ...cards: readonly AnyCard[]): GameState =>
  cards.reduce((current, card) => play(current, card).state, state);

const idOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.instanceId as InstanceId;
const damageOn = (state: GameState, player: PlayerId = p1): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const schemeCounter = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;
const marked = (events: readonly GameEvent[], counterType: string): number =>
  events.findIndex((e) => e.type === "counterAdded" && e.counterType === counterType);
const attack = (events: readonly GameEvent[], phase: "initiated" | "resolved", by?: InstanceId): number =>
  events.findIndex(
    (e) =>
      e.type === "triggerEvent" &&
      e.phase === phase &&
      e.event.kind === "enemyAttack" &&
      (by === undefined || e.event.enemyInstanceId === by),
  );
const attacks = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack" ? [e.event] : [],
  );
/** Takes every optional interrupt offered; everything else by default. */
const takingInterrupts = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  return choice?.prompt.kind === "chooseTriggers" && choice.prompt.timing === "interrupt"
    ? choice.options.map((o) => o.optionId)
    : defaultPick(state);
};

describe("a revealed minion: When Revealed, then quickstrike (RRG 1.8 p. 36, p. 38; answer 30B)", () => {
  it("the When Revealed fully resolves before the quickstrike attack initiates", () => {
    const { state, events, session } = play(game(SENTRY), SCOUT);
    expect(marked(events, "revealed")).toBeGreaterThanOrEqual(0);
    expect(marked(events, "revealed")).toBeLessThan(attack(events, "initiated"));
    expect(attacks(events)).toHaveLength(1);
    expect(damageOn(state)).toBe(2);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("a When Revealed that raises the minion's ATK: the quickstrike attack uses the new ATK (3, not 1)", () => {
    const { state, events } = play(game(ARMED), SCOUT);
    expect(marked(events, "armed")).toBeLessThan(attack(events, "initiated"));
    expect(damageOn(state)).toBe(3);
  });

  it("a When Revealed that exhausts the identity: it is not offered as a defender for the quickstrike attack", () => {
    const offered: string[][] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") offered.push(choice.options.map((o) => o.optionId));
      return defaultPick(state);
    };
    const { state } = play(game(PINNER), SCOUT, pick);
    const identity = mustPlayer(state, p1).identity.instanceId;
    expect(mustInstance(state, identity).exhausted).toBe(true);
    expect(offered.flat()).not.toContain(identity);
    expect(damageOn(state)).toBe(2);
  });

  it("a When Revealed that stuns the hero: the hero is stunned when the quickstrike attack initiates", () => {
    const { state, events } = play(game(STUNNER), SCOUT);
    const stunned = events.findIndex((e) => e.type === "statusGiven" && e.status === "stunned");
    expect(stunned).toBeGreaterThanOrEqual(0);
    expect(stunned).toBeLessThan(attack(events, "initiated"));
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).statuses.stunned).toBe(1);
    expect(damageOn(state)).toBe(2);
  });

  // RRG v1.8 p.38; owner decision 2026-10-16 (audit finding 18). Supersedes answer 33A, which kept the tough card as
  // the minion entered play, so its When Revealed's damage was prevented (damage 0, tough 0).
  it("(c) toughness on a revealed minion arrives after its When Revealed (RRG v1.8 p.38, p.45), before quickstrike", () => {
    const { state, events } = play(game(SHELL), SCOUT);
    const shell = idOf(state, SHELL);
    // Its own When Revealed dealt it 1 damage with no tough card yet; the tough card came once the reveal was done.
    expect(mustInstance(state, shell).damage).toBe(1);
    expect(mustInstance(state, shell).statuses.tough).toBe(1);
    const tough = events.findIndex((e) => e.type === "statusGiven" && e.status === "tough" && e.instanceId === shell);
    expect(marked(events, "revealed")).toBeLessThan(tough);
    expect(tough).toBeLessThan(attack(events, "initiated"));
    expect(damageOn(state)).toBe(2);
  });

  it("interrupts to the minion entering play are not moved: they resolve before its When Revealed", () => {
    const { state, events } = play(withSupports(game(SENTRY), BRACE), SCOUT);
    expect(schemeCounter(state, "brace")).toBe(1);
    expect(marked(events, "brace")).toBeLessThan(marked(events, "revealed"));
  });
});

describe("quickstrike reads the state as it resolves (survey open point 3 = A; RRG 1.8 p. 36)", () => {
  it("the When Revealed discarded the minion: no attack", () => {
    const { state, events } = play(game(VANISH), SCOUT);
    expect(schemeCounter(state, "revealed")).toBe(1);
    expect(attacks(events)).toEqual([]);
    expect(damageOn(state)).toBe(0);
  });

  it("the When Revealed turned the player to alter-ego: no attack", () => {
    const { state, events } = play(game(COWER), SCOUT);
    expect(mustPlayer(state, p1).identity.form).toBe("alterEgo");
    expect(attacks(events)).toEqual([]);
    expect(damageOn(state)).toBe(0);
  });

  it("the When Revealed made another hero engage it: it attacks that hero once, for that engagement (p. 18), and never the revealing player", () => {
    const { state, events } = play(game(TURNCOAT, [], 2), SCOUT);
    const turncoat = idOf(state, TURNCOAT);
    expect(mustInstance(state, turncoat).engagedWith).toBe(p2);
    expect(attacks(events).map((e) => e.attackedPlayerId)).toEqual([p2]);
    expect(damageOn(state, p1)).toBe(0);
    expect(damageOn(state, p2)).toBe(2);
  });

  it("only its When Revealed was cancelled (RRG p. 13): quickstrike is not a When Revealed ability and still attacks", () => {
    const { state, events } = play(withSupports(game(SENTRY), SENSE), SCOUT, takingInterrupts);
    expect(schemeCounter(state, "revealed")).toBe(0);
    expect(attacks(events)).toHaveLength(1);
    expect(damageOn(state)).toBe(2);
  });

  it("all of its effects were cancelled (RRG p. 13): it is discarded and does not attack", () => {
    const { state, events } = play(withSupports(game(SENTRY), WARD), SCOUT, takingInterrupts);
    expect(mustPlayer(state, p1).playArea).not.toContain(idOf(state, SENTRY));
    expect(schemeCounter(state, "revealed")).toBe(0);
    expect(attacks(events)).toEqual([]);
    expect(damageOn(state)).toBe(0);
  });
});

describe("responses to a revealed minion entering play wait for the reveal (RRG 1.8 p. 38; FAQ #10 Widow's Bite, p. 60; answer 32B)", () => {
  it("'after a minion enters play' resolves after its When Revealed and after its quickstrike attack", () => {
    const { state, events } = play(withSupports(game(SENTRY), BITE), SCOUT);
    expect(schemeCounter(state, "bite")).toBe(1);
    expect(marked(events, "revealed")).toBeLessThan(attack(events, "initiated"));
    expect(attack(events, "resolved")).toBeLessThan(marked(events, "bite"));
    // The entering itself resolved in step 2, before the When Revealed; only its response window waited.
    const entered = events.findIndex(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardEntersPlay",
    );
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(entered).toBeLessThan(marked(events, "revealed"));
  });

  it("with no quickstrike it still waits for the When Revealed", () => {
    const { state, events } = play(withSupports(game(DECKHAND), BITE), SCOUT);
    expect(schemeCounter(state, "bite")).toBe(1);
    expect(marked(events, "revealed")).toBeLessThan(marked(events, "bite"));
  });

  // The surge deal is a When Revealed ability (RRG v1.8 p.42), so it comes with them in step 3, before quickstrike
  // (p. 36: "after any 'When Revealed' abilities") and before every response (p. 38); owner decision 2026-10-16 (audit
  // finding 16). Until then this engine dealt it last, after the responses.
  it("the whole order: When Revealed, surge deal, quickstrike, teamwork, enters-play response, 'after you engage' response (p. 36, p. 38, p. 42, p. 43)", () => {
    const { state, events } = play(withSupports(game(CAPTAIN, [MATE]), BITE, GREET), SCOUT);
    const captain = idOf(state, CAPTAIN);
    const steps = [
      marked(events, "revealed"),
      events.findIndex((e) => e.type === "surgeTriggered"),
      attack(events, "initiated", captain),
      attack(events, "resolved", captain),
      events.findIndex((e) => e.type === "keywordResolved" && e.keyword === "teamwork"),
      marked(events, "bite"),
      marked(events, "greet"),
    ];
    expect(steps.every((at) => at >= 0)).toBe(true);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    // Quickstrike's attack and teamwork's activation (an attack, in hero form): ATK 2 twice.
    expect(damageOn(state)).toBe(4);
  });
});

describe("every revealed card that enters play holds its enters-play responses (RRG 1.8 p. 38; answer 35B)", () => {
  const enteredAt = (events: readonly GameEvent[], id: InstanceId): number =>
    events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "resolved" &&
        e.event.kind === "cardEntersPlay" &&
        e.event.instanceId === id,
    );

  it.each([
    ["a side scheme", PLOT],
    ["an attachment", GEAR],
    ["an environment", HAZE],
  ])("%s: 'after it enters play' resolves after its When Revealed", (_what, card) => {
    const { state, events, session } = play(withSupports(game(card), WATCH), SCOUT);
    expect(schemeCounter(state, "watch")).toBe(1);
    expect(schemeCounter(state, "revealed")).toBe(1);
    // It entered play in step 2, before its When Revealed; only the response window waited.
    const entered = enteredAt(events, idOf(state, card));
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(entered).toBeLessThan(marked(events, "revealed"));
    expect(marked(events, "revealed")).toBeLessThan(marked(events, "watch"));
    expect(state.stack).toEqual([]);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("the reveal ends as before: the side scheme in play with its starting threat, the attachment on its host", () => {
    const plot = play(withSupports(game(PLOT), WATCH), SCOUT).state;
    expect(plot.villainArea).toContain(idOf(plot, PLOT));
    expect(mustInstance(plot, idOf(plot, PLOT)).threat).toBe(3);
    const gear = play(withSupports(game(GEAR), WATCH), SCOUT).state;
    expect(mustInstance(gear, idOf(gear, GEAR)).attachedTo).toEqual(expect.any(String));
  });

  it.each([
    ["a side scheme", PLOT],
    ["an attachment", GEAR],
  ])("%s: interrupts to it entering play are not moved, and resolve before its When Revealed", (_what, card) => {
    const { state, events } = play(withSupports(game(card), FORESEE, WATCH), SCOUT);
    expect(schemeCounter(state, "foresee")).toBe(1);
    expect(marked(events, "foresee")).toBeLessThan(marked(events, "revealed"));
    expect(marked(events, "revealed")).toBeLessThan(marked(events, "watch"));
  });

  it("only its When Revealed cancelled (RRG p. 13): it still entered play, and the response is held to the end of the reveal", () => {
    const { state, events } = play(withSupports(game(PLOT), SENSE, WATCH), SCOUT, takingInterrupts);
    expect(schemeCounter(state, "revealed")).toBe(0);
    expect(schemeCounter(state, "watch")).toBe(1);
    expect(enteredAt(events, idOf(state, PLOT))).toBeLessThan(marked(events, "watch"));
  });

  it("all of its effects cancelled (RRG p. 13): it never enters play, so nothing answers", () => {
    const { state } = play(withSupports(game(PLOT), WARD, WATCH), SCOUT, takingInterrupts);
    expect(state.villainArea).not.toContain(idOf(state, PLOT));
    expect(schemeCounter(state, "watch")).toBe(0);
  });

  it("a side scheme put into play without a reveal: nothing holds the response, and no When Revealed resolves (p. 48)", () => {
    const { state, events } = play(withSupports(game(PLOT), WATCH), PLANT);
    expect(state.villainArea).toContain(idOf(state, PLOT));
    expect(schemeCounter(state, "revealed")).toBe(0);
    expect(schemeCounter(state, "watch")).toBe(1);
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(false);
    expect(state.stack).toEqual([]);
  });
});

describe("a revealed minion with teamwork (RRG 1.8 p. 43) and with both keywords (answer 34B)", () => {
  const orderPrompts = (pickOrder?: readonly string[]) => {
    const asked: { player: PlayerId; authority: string; options: string[]; ordered: boolean }[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "orderKeywords") return defaultPick(state);
      asked.push({
        player: choice.playerId,
        authority: choice.authority,
        options: choice.options.map((o) => o.optionId),
        ordered: choice.ordered,
      });
      return pickOrder ?? defaultPick(state);
    };
    return { asked, pick };
  };
  const teamworkAt = (events: readonly GameEvent[]): number =>
    events.findIndex((e) => e.type === "keywordResolved" && e.keyword === "teamwork");

  it("teamwork alone: it activates after the When Revealed, and nobody is asked an order", () => {
    const { asked, pick } = orderPrompts();
    const { state, events } = play(game(DECKHAND, [MATE]), SCOUT, pick);
    expect(asked).toEqual([]);
    expect(marked(events, "revealed")).toBeLessThan(teamworkAt(events));
    expect(damageOn(state)).toBe(1);
  });

  it("both keywords, both live: the first player is asked which resolves first; the default is quickstrike", () => {
    const { asked, pick } = orderPrompts();
    const { state, events, session } = play(game(CAPTAIN, [MATE]), SCOUT, pick);
    expect(asked).toEqual([
      {
        player: state.firstPlayerId,
        authority: "firstPlayerOrders",
        options: ["quickstrike", "teamwork"],
        ordered: true,
      },
    ]);
    expect(attack(events, "resolved")).toBeLessThan(teamworkAt(events));
    expect(damageOn(state)).toBe(4);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("both keywords: choosing teamwork first resolves its activation before the quickstrike attack", () => {
    const { asked, pick } = orderPrompts(["teamwork", "quickstrike"]);
    const { state, events } = play(game(CAPTAIN, [MATE]), SCOUT, pick);
    expect(asked).toHaveLength(1);
    const activated = events.findIndex((e) => e.type === "enemyActivated");
    expect(teamworkAt(events)).toBeGreaterThan(marked(events, "revealed"));
    expect(teamworkAt(events)).toBeLessThan(activated);
    // The teamwork activation's attack resolves, then quickstrike's: two attacks, the keyword line before both.
    expect(attacks(events)).toHaveLength(2);
    expect(teamworkAt(events)).toBeLessThan(attack(events, "initiated"));
    expect(damageOn(state)).toBe(4);
  });

  it("both keywords but no other CREW minion in play: only quickstrike does anything, so nobody is asked", () => {
    const { asked, pick } = orderPrompts();
    const { state, events } = play(game(CAPTAIN), SCOUT, pick);
    expect(asked).toEqual([]);
    expect(teamworkAt(events)).toBe(-1);
    expect(attacks(events)).toHaveLength(1);
    expect(damageOn(state)).toBe(2);
  });

  it("both keywords, the player in alter-ego form: quickstrike does not apply, so nobody is asked and teamwork schemes", () => {
    const start = game(CAPTAIN, [MATE]);
    const alterEgo: GameState = {
      ...start,
      players: start.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const { asked, pick } = orderPrompts();
    const { state, events } = play(alterEgo, SCOUT, pick);
    expect(asked).toEqual([]);
    expect(attacks(events)).toEqual([]);
    expect(teamworkAt(events)).toBeGreaterThan(marked(events, "revealed"));
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
  });

  describe("a When Revealed that moved the minion to another player (RRG 1.8 p. 43; answers 36B, 37A)", () => {
    const teamworkLines = (events: readonly GameEvent[]) =>
      events.flatMap((e) => (e.type === "keywordResolved" && e.keyword === "teamwork" ? [e.playerId] : []));

    it("teamwork activates against the player it is engaged with as it resolves, not the player who revealed it", () => {
      const { asked, pick } = orderPrompts();
      const { state, events, session } = play(game(DEFECTOR, [MATE], 2), SCOUT, pick);
      const defector = idOf(state, DEFECTOR);
      expect(mustInstance(state, defector).engagedWith).toBe(p2);
      expect(asked).toEqual([]);
      expect(teamworkLines(events)).toEqual([p2]);
      expect(marked(events, "revealed")).toBeLessThan(teamworkAt(events));
      expect(attacks(events).map((e) => [e.enemyInstanceId, e.attackedPlayerId])).toEqual([[defector, p2]]);
      expect(damageOn(state, p1)).toBe(0);
      expect(damageOn(state, p2)).toBe(1);
      const replayed = replay(session.log, deps);
      expect(replayed.ok && replayed.state).toEqual(session.state);
    });

    it("the other player in alter-ego form: it schemes against them", () => {
      const start = game(DEFECTOR, [MATE], 2);
      const p2AlterEgo: GameState = {
        ...start,
        players: start.players.map((p) =>
          p.playerId === p2 ? { ...p, identity: { ...p.identity, form: "alterEgo" as const } } : p,
        ),
      };
      const { state, events } = play(p2AlterEgo, SCOUT);
      expect(teamworkLines(events)).toEqual([p2]);
      expect(events.filter((e) => e.type === "enemyActivated")).toEqual([
        { type: "enemyActivated", enemyInstanceId: idOf(state, DEFECTOR), activation: "scheme", playerId: p2 },
      ]);
      expect(attacks(events)).toEqual([]);
      expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
    });

    it("with both keywords: quickstrike keeps to the reveal's engagement, so only teamwork is live and nobody is asked", () => {
      const { asked, pick } = orderPrompts();
      const { state, events } = play(game(MUTINEER, [MATE], 2), SCOUT, pick);
      const mutineer = idOf(state, MUTINEER);
      expect(mustInstance(state, mutineer).engagedWith).toBe(p2);
      // Nothing to order: the reveal's own engagement (with p1) is gone, which is all quickstrike answers here.
      expect(asked).toEqual([]);
      expect(teamworkLines(events)).toEqual([p2]);
      // Two attacks, both on p2 and never p1: quickstrike for the engagement its When Revealed made (p. 18, p. 36),
      // inside that When Revealed, then teamwork's activation once the reveal's steps are done.
      expect(attacks(events).map((e) => e.attackedPlayerId)).toEqual([p2, p2]);
      expect(attack(events, "resolved", mutineer)).toBeLessThan(teamworkAt(events));
      expect(damageOn(state, p1)).toBe(0);
      expect(damageOn(state, p2)).toBe(4);
    });

    it("no other CREW minion in play: teamwork does nothing for the new player either", () => {
      const { state, events } = play(game(DEFECTOR, [], 2), SCOUT);
      expect(mustInstance(state, idOf(state, DEFECTOR)).engagedWith).toBe(p2);
      expect(teamworkLines(events)).toEqual([]);
      expect(events.some((e) => e.type === "enemyActivated")).toBe(false);
    });
  });
});

describe("a minion put into play without being revealed is unchanged (RRG 1.8 p. 18, p. 36, p. 48)", () => {
  it("quickstrike answers the engagement at once; no When Revealed resolves; nobody is asked an order", () => {
    const { state, events } = play(game(SENTRY), AMBUSH);
    expect(mustInstance(state, idOf(state, SENTRY)).engagedWith).toBe(p1);
    expect(schemeCounter(state, "revealed")).toBe(0);
    expect(attacks(events)).toHaveLength(1);
    expect(damageOn(state)).toBe(2);
  });

  it("(e) toughness is placed as it enters play, before its enters-play responses and quickstrike (answer 38A; RRG v1.8 p.38 holds nothing without a reveal)", () => {
    const { state, events } = play(withSupports(game(SHELL), BITE), AMBUSH);
    const shell = idOf(state, SHELL);
    const tough = events.findIndex((e) => e.type === "statusGiven" && e.status === "tough" && e.instanceId === shell);
    expect(tough).toBeGreaterThanOrEqual(0);
    expect(tough).toBeLessThan(marked(events, "bite"));
    expect(marked(events, "bite")).toBeLessThan(attack(events, "initiated"));
    expect(mustInstance(state, shell).statuses.tough).toBe(1);
  });

  it("a response to it entering play is not held: no reveal is in progress, and it keeps its place", () => {
    const { state, events } = play(withSupports(game(SENTRY), BITE), AMBUSH);
    expect(schemeCounter(state, "bite")).toBe(1);
    // As before this change: the enters-play window, then quickstrike (`putIntoPlay`).
    expect(marked(events, "bite")).toBeLessThan(attack(events, "initiated"));
  });
});

describe("a game saved under the old order still loads (docs/phase7-wave10-q30-impact.md §2.2, change 4)", () => {
  /**
   * p1's reveal of the sentry, stopped at the optional interrupt to its entering play: the minion is in play and its
   * reveal frame waits at `uniqueCheck`, where the old engine's frame held `afterUnique: "quickstrike"`.
   */
  function pausedAsItEnters(): { state: GameState; reveal: Extract<GameState["stack"][number], { kind: "reveal" }> } {
    const { state: given, command } = playCommand(withSupports(game(SENTRY), HALT), SCOUT);
    const state = settleUntil(runWith(deps, given, command), "chooseTriggers", deps);
    const reveal = state.stack.find((f) => f.kind === "reveal");
    if (reveal?.kind !== "reveal") throw new Error("no reveal frame on the stack");
    expect(reveal.stage).toBe("uniqueCheck");
    expect(reveal.engagedPlayerId).toBe(p1);
    return { state, reveal };
  }
  const withReveal = (state: GameState, frame: GameState["stack"][number]): GameState => ({
    ...state,
    stack: state.stack.map((f) => (f.frameId === frame.frameId ? frame : f)),
  });

  it("a frame saved before its legacy `quickstrike` stage: the When Revealed resolves, then it attacks once", () => {
    const { state, reveal } = pausedAsItEnters();
    const { engagedPlayerId: _unknownThen, ...old } = reveal;
    const legacy = withReveal(state, { ...old, afterUnique: "quickstrike" });
    const done = settle(legacy, defaultPick, deps);
    expect(done.stack).toEqual([]);
    expect(schemeCounter(done, "revealed")).toBe(1);
    expect(damageOn(done)).toBe(2);
  });

  it("a frame saved at the legacy `quickstrike` stage itself resolves the same way", () => {
    const { state, reveal } = pausedAsItEnters();
    const { engagedPlayerId: _unknownThen, ...old } = reveal;
    const done = settle(withReveal(state, { ...old, stage: "quickstrike" }), defaultPick, deps);
    expect(done.stack).toEqual([]);
    expect(schemeCounter(done, "revealed")).toBe(1);
    expect(damageOn(done)).toBe(2);
  });

  it("a frame saved after it (its quickstrike already resolved under the old order) does not attack again", () => {
    const { state, reveal } = pausedAsItEnters();
    const { engagedPlayerId: _unknownThen, ...old } = reveal;
    const done = settle(withReveal(state, { ...old, stage: "whenRevealed" }), defaultPick, deps);
    expect(done.stack).toEqual([]);
    expect(schemeCounter(done, "revealed")).toBe(1);
    expect(damageOn(done)).toBe(0);
  });
});
