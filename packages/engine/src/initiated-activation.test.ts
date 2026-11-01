/**
 * A keyword's activation initiates once the effect that made it has finished and resolves its steps once the ability
 * around it has finished (`resolve/initiated-activation.ts`), proven with synthetic cards.
 *
 * FFG ruling January 11, 2024 - Ruling 137 (Planetary Invasion: quickstrike "initiat[es] its attack. (The steps of the
 * attack will then resolve at the next available opportunity.)"); ruling May 23, 2024 - Ruling 194 (Shadow of the
 * Past: "the attack resolves as soon as the ability that put her into play finishes"); teamwork shares the model,
 * ruling December 8, 2023 - Ruling 129 and February 15, 2024 - Ruling 147; an "each time" loop holds its minions'
 * keywords and responses until it has resolved, ruling November 19, 2024 - Ruling 38 (Drang III).
 */

import { flat, trait, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { currentEnemyAttackFrame } from "./defense-claim.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, DEFENDER_SLOT, resolvePlayers, resolveRef } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import { awaitingAbility, type StackFrame } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const CREW = trait("CREW");
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

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** Quickstrike, ATK 2. */
const SENTRY = stubMinion({ id: "sentry", atk: 2, sch: 1, hp: 5, boostIcons: 0, keywords: [{ name: "quickstrike" }] });
/** Quickstrike, ATK 3: a second minion to tell apart. */
const RAIDER = stubMinion({ id: "raider", atk: 3, sch: 1, hp: 5, boostIcons: 0, keywords: [{ name: "quickstrike" }] });
/** Teamwork (CREW), ATK 1. */
const DECKHAND = stubMinion({
  id: "deckhand",
  traits: [CREW],
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "teamwork", sharedTrait: CREW }],
});
/** A CREW minion to stand beside it. */
const MATE = stubMinion({ id: "mate", traits: [CREW], atk: 0, sch: 0, hp: 5, boostIcons: 0 });

const putTopMinion: readonly EffectSpec[] = [
  {
    kind: "selectCards",
    slot: "m",
    cards: { kind: "encounter", zones: ["deck"], filter: { categories: ["minion"] } },
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: you },
];
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubEvent({ id, cost: 0, abilities: [ability(`${id}.action`, { trigger: { kind: "action" }, effects })] });
/** "Put the minions of the encounter deck into play engaged with you. (Then) leave a mark." */
const AMBUSH_THEN = action("ambush-then", [...putTopMinion, mark("after")]);
/** "Put the minions of the encounter deck into play engaged with you." Nothing after it. */
const AMBUSH = action("ambush", putTopMinion);
/** "Put the minions … into play engaged with you. Deal 5 damage to them. Leave a mark." */
const AMBUSH_KILL = action("ambush-kill", [
  ...putTopMinion,
  { kind: "dealDamage", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: 5 } },
  mark("after"),
]);
/** "Put the minions … into play engaged with you. At the end of this attack, leave a mark. Leave a mark." */
const AMBUSH_END = action("ambush-end", [
  ...putTopMinion,
  { kind: "atEndOfAttack", effects: [mark("end")] },
  mark("after"),
]);
const theVillainAttacksYou: EffectSpec = { kind: "enemyAttack", enemies: { kind: "villain" }, against: you };
/** "Put the minions … into play engaged with you. The villain attacks you. Leave a mark." */
const AMBUSH_ATTACK = action("ambush-attack", [...putTopMinion, theVillainAttacksYou, mark("after")]);
/**
 * "Forced Interrupt: When the villain attacks you, put the minions … into play engaged with you. The villain attacks
 * you. Leave a mark." Once per round, so its own attack does not fire it again.
 */
const CALL_ATTACK = stubSupport({
  id: "call-attack",
  cost: 0,
  abilities: [
    ability("call-attack.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
      },
      limit: { count: 1, period: "round" },
      effects: [...putTopMinion, theVillainAttacksYou, mark("after")],
    }),
  ],
});
/**
 * Drang III's shape: "Discard the top 3 cards of the encounter deck. Each time a minion is discarded this way, put it
 * into play engaged with you."
 */
const DISCARD_LOOP: EffectSpec = {
  kind: "discardEncounterCards",
  count: { kind: "const", value: 3 },
  forEachDiscarded: {
    slot: "d",
    effects: [
      {
        kind: "if",
        condition: {
          kind: "refMatches",
          ref: { kind: "slot", slot: "d" },
          query: { categories: ["minion"] },
          anywhere: true,
        },
        then: [{ kind: "putIntoPlay", card: { kind: "slot", slot: "d" }, controller: you }],
      },
    ],
  },
};
const LOOP = action("loop", [DISCARD_LOOP]);
/** The same loop with more of the ability after it: "… put it into play engaged with you. Leave a mark." */
const LOOP_THEN = action("loop-then", [DISCARD_LOOP, mark("after")]);
/** "Forced Interrupt: When an enemy attacks you, leave a mark." */
const WATCH = stubSupport({
  id: "watch",
  cost: 0,
  abilities: [
    ability("watch.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", playerIs: "controller" } },
      effects: [mark("watch")],
    }),
  ],
});
/** Widow's Bite's shape: "Forced Response: After a minion enters play, leave a mark." */
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
/**
 * "Forced Interrupt: When the villain attacks you, put the minions of the encounter deck into play engaged with you.
 * Declare your hero the defender. Choose a number. Leave a mark." The number is a probe: the test reads the state while it is asked.
 */
const CALL = stubSupport({
  id: "call",
  cost: 0,
  abilities: [
    ability("call.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
      },
      effects: [
        ...putTopMinion,
        { kind: "declareDefender", character: { kind: "identityOf", player: you } },
        { kind: "chooseNumber", player: you, max: { kind: "const", value: 1 }, bind: "probe" },
        mark("called"),
      ],
    }),
  ],
});
/** "Forced Interrupt (defense): When the villain attacks you, put the minions … into play. Declare <who> the defender." */
const labeledDefense = (id: string, defender: TargetRef) =>
  stubSupport({
    id,
    cost: 0,
    abilities: [
      ability(`${id}.interrupt`, {
        trigger: {
          kind: "interrupt",
          forced: true,
          on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
        },
        label: ["defense"],
        effects: [
          ...putTopMinion,
          { kind: "declareDefender", character: defender },
          { kind: "chooseNumber", player: you, max: { kind: "const", value: 1 }, bind: "probe" },
        ],
      }),
    ],
  });
const BODYGUARD = stubAlly({ id: "bodyguard", cost: 0, atk: 1, thw: 1, hp: 3 });
const ALLY_DEFENSE = labeledDefense("ally-defense", { kind: "named", name: "bodyguard" });
const HERO_DEFENSE = labeledDefense("hero-defense", { kind: "identityOf", player: you });
/** A minion that answers any minion entering play, its own entering included: "Forced Response: After a minion enters
 * play, leave a mark." */
const LOOKOUT = stubMinion({
  id: "lookout",
  atk: 0,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  abilities: [
    ability("lookout.response", {
      trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [mark("lookout")],
    }),
  ],
});
/** "Forced Response: After a character defends, leave a mark." */
const GUARDED = stubSupport({
  id: "guarded",
  cost: 0,
  abilities: [
    ability("guarded.response", {
      trigger: { kind: "response", forced: true, on: { on: "defended" } },
      effects: [mark("defends")],
    }),
  ],
});
/** "Forced Interrupt: When a minion enters play, cancel that." */
const BAR = stubSupport({
  id: "bar",
  cost: 0,
  abilities: [
    ability("bar.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [{ kind: "cancelTriggeringEvent" }],
    }),
  ],
});
/** "Forced Interrupt: When a minion enters play, deal 5 damage to it." */
const TRAP = stubSupport({
  id: "trap",
  cost: 0,
  abilities: [
    ability("trap.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: 5 } }],
    }),
  ],
});

/** "Forced Response: After a minion enters play, deal 5 damage to it." Defeats a 5-HP minion. */
const SNIPER = stubSupport({
  id: "sniper",
  cost: 0,
  abilities: [
    ability("sniper.response", {
      trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["minion"] } } },
      effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: 5 } }],
    }),
  ],
});
/** "Forced Response: After a minion engages you, leave a mark." */
const ENGAGED = stubSupport({
  id: "engaged",
  cost: 0,
  abilities: [
    ability("engaged.response", {
      trigger: { kind: "response", forced: true, on: { on: "minionEngaged" } },
      effects: [mark("engaged")],
    }),
  ],
});
/**
 * "Forced Interrupt: When the villain attacks you, put the minions of the encounter deck into play engaged with you."
 * Its last effect puts the minion into play. Once per round.
 */
const CALL_LAST = stubSupport({
  id: "call-last",
  cost: 0,
  abilities: [
    ability("call-last.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
      },
      limit: { count: 1, period: "round" },
      effects: putTopMinion,
    }),
  ],
});
/** CALL_LAST with more of it after: "… put the minions … into play engaged with you. Leave a mark." Once per round. */
const CALL_THEN = stubSupport({
  id: "call-then",
  cost: 0,
  abilities: [
    ability("call-then.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
      },
      limit: { count: 1, period: "round" },
      effects: [...putTopMinion, mark("after")],
    }),
  ],
});
/** A forced interrupt to the villain's attack on you, once per round, resolving `effects`. */
const onVillainAttack = (id: string, effects: readonly EffectSpec[]) =>
  stubSupport({
    id,
    cost: 0,
    abilities: [
      ability(`${id}.interrupt`, {
        trigger: {
          kind: "interrupt",
          forced: true,
          on: { on: "enemyAttack", playerIs: "controller", sourceIs: { categories: ["villain"] } },
        },
        limit: { count: 1, period: "round" },
        effects,
      }),
    ],
  });
/** "Forced Interrupt: When the villain attacks you, (Drang III's loop)." The loop is its last effect. */
const CALL_LOOP = onVillainAttack("call-loop", [DISCARD_LOOP]);
/** CALL_LOOP with more of it after the loop: "… put it into play engaged with you. Leave a mark." */
const CALL_LOOP_THEN = onVillainAttack("call-loop-then", [DISCARD_LOOP, mark("after")]);
/** "Forced Interrupt: When the villain attacks you, cancel that attack. Leave a mark." */
const CANCEL_ATTACK = onVillainAttack("cancel-attack", [{ kind: "cancelTriggeringEvent" }, mark("cancel")]);
/** "Forced Interrupt: When the villain would attack you, leave a mark instead." A replacement. */
const REPLACE_ATTACK = onVillainAttack("replace-attack", [
  { kind: "replaceTriggeringEvent", with: [mark("replaced")] },
]);
/** "Boost: Put the minions of the encounter deck into play engaged with you." */
const BOOSTER = stubTreachery({
  id: "booster",
  boostIcons: 0,
  abilities: [ability("booster.boost", { trigger: { kind: "boost" }, effects: putTopMinion })],
});
/**
 * Planetary Invasion's shape (16057): "When Revealed: Reveal the minion of the encounter deck. Leave a mark." The mark
 * stands for "then give it a tough status card": more of the When Revealed after the reveal.
 */
const INVASION = stubTreachery({
  id: "invasion",
  boostIcons: 0,
  abilities: [
    ability("invasion.when-revealed", {
      trigger: { kind: "whenRevealed" },
      effects: [
        {
          kind: "selectCards",
          slot: "m",
          cards: { kind: "encounter", zones: ["deck"], filter: { categories: ["minion"] } },
        },
        { kind: "revealCard", cards: { kind: "slot", slot: "m" }, player: you },
        mark("after"),
      ],
    }),
  ],
});

const PLAYER_CARDS: readonly AnyCard[] = [
  AMBUSH_THEN,
  AMBUSH_ATTACK,
  CALL_ATTACK,
  AMBUSH,
  AMBUSH_KILL,
  AMBUSH_END,
  LOOP,
  LOOP_THEN,
  WATCH,
  CALL,
  BITE,
  GUARDED,
  BAR,
  TRAP,
  ALLY_DEFENSE,
  HERO_DEFENSE,
  BODYGUARD,
  SNIPER,
  ENGAGED,
  CALL_LAST,
  CALL_THEN,
  CALL_LOOP,
  CALL_LOOP_THEN,
  CANCEL_ATTACK,
  REPLACE_ATTACK,
];
const deps: EngineDeps = depsOf(...abilities);

/** p1's turn in hero form, `top` on top of the encounter deck (blanks beneath), `inPlay` engaged with p1. */
function game(top: AnyCard | readonly AnyCard[], inPlay: readonly AnyCard[] = []): GameState {
  const tops: readonly AnyCard[] = Array.isArray(top) ? top : [top as AnyCard];
  const start = newGame({
    players: 1,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [SENTRY, RAIDER, DECKHAND, MATE, LOOKOUT, INVASION, BOOSTER, ...PLAYER_CARDS, BLANK],
    encounterDeck: [...tops.map((card) => card.id), ...inPlay.map((card) => card.id), ...copies(BLANK.id, 15)],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((card) => card.id)],
  });
  let deck = [...activeEncounterDeck(start).deck];
  const take = (card: AnyCard): InstanceId => {
    const id = deck.find((i) => start.instances[i]?.cardId === card.id) as InstanceId;
    deck = deck.filter((i) => i !== id);
    return id;
  };
  const topIds = tops.map(take);
  const inPlayIds = inPlay.map(take);
  const surgery = withEncounterPiles(start, { deck: [...topIds, ...deck] });
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

function play(state: GameState, card: AnyCard, pick: (state: GameState) => readonly string[] = defaultPick) {
  const given = giveCard(state, p1, card.id);
  return runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const idOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.instanceId as InstanceId;
const damageOn = (state: GameState): number => mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;
const marked = (events: readonly GameEvent[], counterType: string): number =>
  events.findIndex((e) => e.type === "counterAdded" && e.counterType === counterType);
const attack = (events: readonly GameEvent[], phase: "initiated" | "resolved", by: InstanceId): number =>
  events.findIndex(
    (e) =>
      e.type === "triggerEvent" &&
      e.phase === phase &&
      e.event.kind === "enemyAttack" &&
      e.event.enemyInstanceId === by,
  );
/** How many attacks by `by` resolved. */
const attackCount = (events: readonly GameEvent[], by: InstanceId): number =>
  events.filter(
    (e) =>
      e.type === "triggerEvent" &&
      e.phase === "resolved" &&
      e.event.kind === "enemyAttack" &&
      e.event.enemyInstanceId === by,
  ).length;
const firstDamage = (events: readonly GameEvent[]): number => events.findIndex((e) => e.type === "damageDealt");
const awaited = (events: readonly GameEvent[]) => events.filter((e) => e.type === "activationAwaitsAbility");
/** The indexes of the cards moved from the encounter deck to its discard pile. */
const discards = (events: readonly GameEvent[]): readonly number[] =>
  events.flatMap((e, at) =>
    e.type === "cardMoved" && e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard" ? [at] : [],
  );

describe("a keyword's activation initiates now and resolves after the ability around it (rulings 137, 194)", () => {
  it("quickstrike: the attack initiates as the minion enters play, and its damage follows the ability's next effect", () => {
    const { state, events } = play(game(SENTRY), AMBUSH_THEN);
    const sentry = idOf(state, SENTRY);
    expect(damageOn(state)).toBe(2);
    expect(attack(events, "initiated", sentry)).toBeGreaterThanOrEqual(0);
    expect(attack(events, "initiated", sentry)).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(firstDamage(events));
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry, activation: "attack" }]);
  });

  it("quickstrike: with nothing left of the ability after it, the attack resolves at once and waits for nothing", () => {
    const { state, events } = play(game(SENTRY), AMBUSH);
    expect(damageOn(state)).toBe(2);
    expect(awaited(events)).toEqual([]);
  });

  it("teamwork: the activation initiates as the minion enters play, and its damage follows the ability's next effect", () => {
    const { state, events } = play(game(DECKHAND, [MATE]), AMBUSH_THEN);
    const deckhand = idOf(state, DECKHAND);
    expect(damageOn(state)).toBe(1);
    expect(attack(events, "initiated", deckhand)).toBeGreaterThanOrEqual(0);
    expect(attack(events, "initiated", deckhand)).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(firstDamage(events));
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: deckhand, activation: "attack" }]);
  });

  it("two minions parked by one ability resolve in the order they were initiated", () => {
    const { state, events } = play(game([SENTRY, RAIDER]), AMBUSH_THEN);
    const [sentry, raider] = [idOf(state, SENTRY), idOf(state, RAIDER)];
    expect(damageOn(state)).toBe(5);
    expect(awaited(events).map((e) => e.enemyInstanceId)).toEqual([sentry, raider]);
    expect(attack(events, "initiated", sentry)).toBeLessThan(attack(events, "initiated", raider));
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(attack(events, "resolved", sentry)).toBeLessThan(attack(events, "resolved", raider));
  });

  it("a parked minion the rest of its ability defeats deals no damage: its activation ends as it left play", () => {
    const { state, events } = play(game(SENTRY), AMBUSH_KILL);
    const sentry = idOf(state, SENTRY);
    expect(damageOn(state)).toBe(0);
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry }]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "activationSkipped", enemyInstanceId: sentry, reason: "leftPlay" }),
    );
  });

  it("'at the end of this attack' in a later sentence names the parked attack (ruling 147)", () => {
    const { state, events } = play(game(SENTRY), AMBUSH_END);
    const sentry = idOf(state, SENTRY);
    expect(damageOn(state)).toBe(2);
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(marked(events, "end")).toBeGreaterThan(firstDamage(events));
  });

  it("inside an outer villain attack the defense lookups read the outer attack; 'the attacking enemy' names the parked one", () => {
    const withCall = play(play(game(SENTRY), CALL).state, GUARDED).state;
    const villain = withCall.villains[0]!.instanceId;
    const hero = mustPlayer(withCall, p1).identity.instanceId;
    const seen: Record<string, unknown>[] = [];
    const probe = (state: GameState): readonly string[] => {
      if (state.pendingChoice?.prompt.kind === "chooseNumber" && state.stack.some(awaitingAbility)) {
        const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
        const outer = currentEnemyAttackFrame(state);
        const parked = state.stack.find(awaitingAbility);
        seen.push({
          defended: outer?.event.kind === "enemyAttack" ? outer.event.enemyInstanceId : null,
          // The effect's declared defender went onto the outer attack, not the parked one.
          outerDefender: outer?.slots[DEFENDER_SLOT] ?? [],
          parkedDefender: parked?.kind === "event" ? (parked.slots[DEFENDER_SLOT] ?? []) : null,
          defending: resolveRef(state, { kind: "defendingCharacter" }, context),
          attackedCharacter: resolveRef(state, { kind: "attackedCharacter" }, context),
          attackedPlayer: resolvePlayers(state, { kind: "attackedPlayer" }, context),
          attacking: resolveRef(state, { kind: "attackingEnemy" }, context),
        });
      }
      return defaultPick(state);
    };
    const { state, events } = runCommandsPicking(withCall, deps, probe, { type: "endTurn", playerId: p1 });
    expect(seen).toEqual([
      {
        defended: villain,
        outerDefender: [hero],
        parkedDefender: [],
        defending: [hero],
        attackedCharacter: [hero],
        attackedPlayer: [p1],
        attacking: [idOf(state, SENTRY)],
      },
    ]);
    // "After a character defends" waits for the end of the outer attack, not of the parked one (RRG 1.8 p. 16).
    expect(marked(events, "defends")).toBeGreaterThan(attack(events, "resolved", villain));
  });
});

describe("the responses to a minion entering play or engaging resolve after its keyword initiates and before the activation's steps", () => {
  /**
   * Keywords have timing priority over Responses (RRG 1.8 FAQ "Widow's Bite (#10)", p. 60); the Responses resolve after
   * the initiation and before the activation's steps (rulings October 2023 - Ruling 97, January 11, 2024 - Ruling 137,
   * February 15, 2024 - Ruling 147); a minion that leaves play ends its activation (RRG 1.8 "Activation", p. 6).
   */
  const damageBy = (events: readonly GameEvent[], by: InstanceId): number =>
    events.findIndex((e) => e.type === "damageDealt" && e.sourceInstanceId === by);

  it("a put-into-play: the enters-play window still opens before quickstrike (38A); 'after you engage' follows the initiation, before the steps", () => {
    const ready = play(play(game(SENTRY), BITE).state, ENGAGED).state;
    const { state, events } = play(ready, AMBUSH_THEN);
    const sentry = idOf(state, SENTRY);
    expect(marked(events, "bite")).toBeGreaterThanOrEqual(0);
    expect(marked(events, "bite")).toBeLessThan(attack(events, "initiated", sentry));
    expect(marked(events, "engaged")).toBeGreaterThan(attack(events, "initiated", sentry));
    expect(marked(events, "engaged")).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(damageOn(state)).toBe(2);
  });

  it("revealed by a When Revealed (Planetary Invasion's shape): initiated, the rest of the When Revealed, the held Response, then the steps", () => {
    const withBite = play(game([BLANK, INVASION, SENTRY]), BITE).state;
    const { state, events } = runCommandsPicking(withBite, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    const initiated = attack(events, "initiated", sentry);
    expect(initiated).toBeGreaterThanOrEqual(0);
    expect(marked(events, "after")).toBeGreaterThan(initiated);
    // The reveal holds the Response until its steps are done (RRG 1.8 "Reveal", p. 38), after the When Revealed.
    expect(marked(events, "bite")).toBeGreaterThan(marked(events, "after"));
    expect(damageBy(events, sentry)).toBeGreaterThan(marked(events, "bite"));
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(marked(events, "bite"));
  });

  it("a Response that defeats the minion before the steps ends its activation: no attack damage is dealt", () => {
    const withSniper = play(game([BLANK, INVASION, SENTRY]), SNIPER).state;
    const { state, events } = runCommandsPicking(withSniper, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    expect(attack(events, "initiated", sentry)).toBeGreaterThanOrEqual(0);
    expect(cardsInPlay(state)).not.toContain(sentry);
    expect(damageBy(events, sentry)).toBe(-1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "activationSkipped", enemyInstanceId: sentry, reason: "leftPlay" }),
    );
  });
});

describe("an ability's own enemy activation does not wait behind the keyword activation it parked (RRG 1.8 p. 6)", () => {
  /** The indexes of the `phase` log lines of every attack by `by`, in order. */
  const attacks = (events: readonly GameEvent[], phase: "initiated" | "resolved", by: InstanceId): readonly number[] =>
    events.flatMap((e, at) =>
      e.type === "triggerEvent" && e.phase === phase && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === by
        ? [at]
        : [],
    );

  it("'the villain attacks you' resolves in place, then the rest of the ability, then the quickstrike attack", () => {
    const { state, events } = play(game(SENTRY), AMBUSH_ATTACK);
    const [sentry, villain] = [idOf(state, SENTRY), state.villains[0]!.instanceId];
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry }]);
    expect(attack(events, "initiated", sentry)).toBeLessThan(attack(events, "initiated", villain));
    expect(attack(events, "resolved", villain)).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(damageOn(state)).toBe(3);
  });

  it("inside an outer villain attack, its attack and the quickstrike attack both wait for the outer attack", () => {
    const withCall = play(game(SENTRY), CALL_ATTACK).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    const [outerResolved, innerResolved] = attacks(events, "resolved", villain);
    const [, innerInitiated] = attacks(events, "initiated", villain);
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry }]);
    expect(outerResolved).toBeGreaterThanOrEqual(0);
    expect(innerInitiated).toBeGreaterThan(outerResolved!);
    // The quickstrike resolves, and before Sentry's own activation in the minion step attacks again (not lost while it
    // waited).
    const sentryResolved = attacks(events, "resolved", sentry);
    const sentryInitiated = attacks(events, "initiated", sentry);
    expect(sentryResolved).toHaveLength(2);
    expect(sentryResolved[0]).toBeLessThan(sentryInitiated[1]!);
    expect(sentryResolved[0]).toBeGreaterThan(outerResolved!);
    expect(innerResolved).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(sentryResolved[0]!);
  });
});

describe("an activation initiated by an ability's last effect inside an outer enemy activation", () => {
  /**
   * With nothing of the ability left after the effect that initiated it (`abilityHasMore` false) the activation still
   * waits for the villain's attack: an activation cannot resolve within another one (RRG 1.8 "Activation", p. 6), and
   * the attack waits at least for the ability that put the minion into play (ruling May 23, 2024 - Ruling 194).
   */
  it("a forced interrupt to the villain's attack whose last effect puts a quickstrike minion into play: the minion attacks after the villain's attack resolves", () => {
    const withCall = play(game(SENTRY), CALL_LAST).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    expect(attack(events, "resolved", villain)).toBeGreaterThanOrEqual(0);
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(attack(events, "resolved", villain));
  });

  it("with more of the interrupt after it, the minion waits for the interrupt, then for the villain's attack", () => {
    const withCall = play(game(SENTRY), CALL_THEN).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry }]);
    expect(attack(events, "initiated", sentry)).toBeLessThan(marked(events, "after"));
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", villain));
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(attack(events, "resolved", villain));
  });

  it("teamwork: the minion's activation waits for the villain's attack the same way", () => {
    const withCall = play(game(DECKHAND, [MATE]), CALL_LAST).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const deckhand = idOf(state, DECKHAND);
    expect(attack(events, "initiated", deckhand)).toBeLessThan(attack(events, "resolved", villain));
    expect(attack(events, "resolved", deckhand)).toBeGreaterThan(attack(events, "resolved", villain));
  });

  it("an 'each time' loop as the interrupt's last effect: the minion attacks after the villain's attack, then the held response (ruling 38)", () => {
    const withCall = play(play(game(SENTRY), BITE).state, CALL_LOOP).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    expect(attack(events, "initiated", sentry)).toBeGreaterThan(discards(events)[2]!);
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(attack(events, "resolved", villain));
    expect(marked(events, "bite")).toBeGreaterThan(attack(events, "resolved", sentry));
  });

  it("the villain's attack cancelled after the minion's attack queued behind it: the minion still attacks (ruling 148)", () => {
    const withCall = play(play(game(SENTRY), CALL_LAST).state, CANCEL_ATTACK).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    const initiated = attack(events, "initiated", sentry);
    expect(initiated).toBeGreaterThanOrEqual(0);
    expect(initiated).toBeLessThan(marked(events, "cancel"));
    expect(attack(events, "resolved", villain)).toBe(-1);
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(marked(events, "cancel"));
    // Its quickstrike attack, not lost, then its own activation in the minion step.
    expect(attackCount(events, sentry)).toBe(2);
  });

  it("the villain's attack replaced after the minion's attack queued behind it: the minion still attacks", () => {
    const withCall = play(play(game(SENTRY), CALL_LAST).state, REPLACE_ATTACK).state;
    const villain = withCall.villains[0]!.instanceId;
    const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
    const sentry = idOf(state, SENTRY);
    const initiated = attack(events, "initiated", sentry);
    expect(initiated).toBeGreaterThanOrEqual(0);
    expect(initiated).toBeLessThan(marked(events, "replaced"));
    expect(attack(events, "resolved", villain)).toBe(-1);
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(marked(events, "replaced"));
    // Its quickstrike attack, not lost, then its own activation in the minion step.
    expect(attackCount(events, sentry)).toBe(2);
  });

  it.each([
    ["the loop is the interrupt's last effect", CALL_LOOP],
    ["more of the interrupt follows the loop", CALL_LOOP_THEN],
  ] as const)(
    "two minions from an 'each time' loop inside the villain's attack (%s): villain, Sentry, Raider, then the held responses (ruling 38; RRG 1.8 p. 6)",
    (_shape, call) => {
      const withCall = play(play(game([SENTRY, RAIDER]), BITE).state, call).state;
      const villain = withCall.villains[0]!.instanceId;
      const { state, events } = runCommandsPicking(withCall, deps, defaultPick, { type: "endTurn", playerId: p1 });
      const [sentry, raider] = [idOf(state, SENTRY), idOf(state, RAIDER)];
      const bites = events.flatMap((e, at) => (e.type === "counterAdded" && e.counterType === "bite" ? [at] : []));
      expect(bites).toHaveLength(2);
      expect(attack(events, "resolved", villain)).toBeLessThan(attack(events, "resolved", sentry));
      expect(attack(events, "resolved", sentry)).toBeLessThan(attack(events, "resolved", raider));
      expect(attack(events, "resolved", raider)).toBeLessThan(bites[0]!);
      expect(attack(events, "resolved", raider)).toBeLessThan(bites[1]!);
    },
  );

  it("a Boost ability that puts the minion into play during the villain's attack: the minion attacks after it (RRG 1.8 p. 6)", () => {
    const { state, events } = runCommandsPicking(game([BOOSTER, SENTRY]), deps, defaultPick, {
      type: "endTurn",
      playerId: p1,
    });
    const villain = state.villains[0]!.instanceId;
    const sentry = idOf(state, SENTRY);
    const initiated = attack(events, "initiated", sentry);
    expect(initiated).toBeGreaterThan(attack(events, "initiated", villain));
    expect(initiated).toBeLessThan(attack(events, "resolved", villain));
    expect(attack(events, "resolved", sentry)).toBeGreaterThan(attack(events, "resolved", villain));
  });
});

describe('a "(defense)" ability inside the outer attack\'s window does not reach the parked attack', () => {
  it.each([
    ["an ally", ALLY_DEFENSE],
    ["the hero", HERO_DEFENSE],
  ] as const)("declaring %s the defender marks the outer attack only", (_who, card) => {
    const withAlly = play(play(game(SENTRY), BODYGUARD).state, card).state;
    const villain = withAlly.villains[0]!.instanceId;
    const seen: { readonly outer: InstanceId | null; readonly outerMarks: number; readonly parkedMarks: number }[] = [];
    // What a labeled defense writes on the attack's event frame: the defender, the hero it was labeled for, the label.
    const marksOf = (f: StackFrame | undefined): number =>
      f?.kind !== "event"
        ? -1
        : (f.slots[DEFENDER_SLOT]?.length ?? 0) +
          (f.slots["labeledDefenseHero"]?.length ?? 0) +
          (f.vars.labeledDefense ?? 0);
    const probe = (state: GameState): readonly string[] => {
      if (state.pendingChoice?.prompt.kind === "chooseNumber" && state.stack.some(awaitingAbility)) {
        const outer = currentEnemyAttackFrame(state);
        seen.push({
          outer: outer?.event.kind === "enemyAttack" ? outer.event.enemyInstanceId : null,
          outerMarks: marksOf(outer ?? undefined),
          parkedMarks: marksOf(state.stack.find(awaitingAbility)),
        });
      }
      return defaultPick(state);
    };
    runCommandsPicking(withAlly, deps, probe, { type: "endTurn", playerId: p1 });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.outer).toBe(villain);
    expect(seen[0]!.outerMarks).toBeGreaterThanOrEqual(2);
    expect(seen[0]!.parkedMarks).toBe(0);
  });
});

describe("an 'each time' loop holds its minions' keywords and responses until it has resolved (ruling 38)", () => {
  it("no attack initiates and no 'when … attacks' window opens before the last discard; two keywords are ordered by the first player, discard order by default", () => {
    const asked: string[][] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "orderLoopKeywords") asked.push(choice.options.map((o) => o.label ?? ""));
      return defaultPick(state);
    };
    const withWatch = play(game([SENTRY, RAIDER]), WATCH).state;
    const { state, events } = play(withWatch, LOOP, pick);
    const [sentry, raider] = [idOf(state, SENTRY), idOf(state, RAIDER)];
    const lastDiscard = discards(events)[2]!;
    const window = events.findIndex((e) => e.type === "windowOpened" && e.event.kind === "enemyAttack");
    expect(window).toBeGreaterThan(lastDiscard);
    expect(attack(events, "initiated", sentry)).toBeGreaterThan(lastDiscard);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(2);
    expect(asked[0]![0]).toMatch(/^Quickstrike: /);
    expect(attack(events, "resolved", sentry)).toBeLessThan(attack(events, "initiated", raider));
    expect(damageOn(state)).toBe(5);
  });

  it("the responses to the minions entering play wait for the loop and for their quickstrike attacks", () => {
    const withBite = play(game(SENTRY), BITE).state;
    const { state, events } = play(withBite, LOOP);
    const sentry = idOf(state, SENTRY);
    expect(marked(events, "bite")).toBeGreaterThan(discards(events)[2]!);
    expect(marked(events, "bite")).toBeGreaterThan(attack(events, "resolved", sentry));
  });

  it("with more of the ability after the loop, the held responses still follow the released attack's steps", () => {
    const withBite = play(game(SENTRY), BITE).state;
    const { state, events } = play(withBite, LOOP_THEN);
    const sentry = idOf(state, SENTRY);
    expect(awaited(events)).toMatchObject([{ enemyInstanceId: sentry }]);
    expect(attack(events, "initiated", sentry)).toBeGreaterThan(discards(events)[2]!);
    expect(marked(events, "after")).toBeLessThan(attack(events, "resolved", sentry));
    expect(marked(events, "bite")).toBeGreaterThan(attack(events, "resolved", sentry));
    expect(damageOn(state)).toBe(2);
  });

  it("a minion whose entering play was cancelled loses its held responses, keywords and engagement announcement", () => {
    const guarded = play(play(game(SENTRY), BITE).state, BAR).state;
    const { state, events } = play(guarded, LOOP);
    const sentry = idOf(state, SENTRY);
    expect(marked(events, "bite")).toBe(-1);
    expect(attack(events, "initiated", sentry)).toBe(-1);
    expect(events.some((e) => e.type === "activationSkipped" && e.enemyInstanceId === sentry)).toBe(false);
    expect(damageOn(state)).toBe(0);
  });

  it("a minion that entered play and then left in its pass keeps its held responses (RRG 1.8 p. 45)", () => {
    const trapped = play(play(game(SENTRY), BITE).state, TRAP).state;
    const { state, events } = play(trapped, LOOP);
    expect(marked(events, "bite")).toBeGreaterThan(discards(events)[2]!);
    expect(damageOn(state)).toBe(0);
  });

  it("a minion entering play in a later pass is not offered an earlier minion's held response (entered-since)", () => {
    const { events } = play(game([SENTRY, LOOKOUT]), LOOP);
    // The lookout answers its own entering, once; the sentry's entering occurred before the lookout was in play.
    expect(events.filter((e) => e.type === "counterAdded" && e.counterType === "lookout")).toHaveLength(1);
  });

  it("the first player may order the second minion's quickstrike first", () => {
    const reversed = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "orderLoopKeywords") return [...choice.options].reverse().map((o) => o.optionId);
      return defaultPick(state);
    };
    const { state, events } = play(game([SENTRY, RAIDER]), LOOP, reversed);
    const [sentry, raider] = [idOf(state, SENTRY), idOf(state, RAIDER)];
    expect(attack(events, "resolved", raider)).toBeLessThan(attack(events, "initiated", sentry));
  });

  it("one held keyword is not asked about; teamwork held in a loop activates once every card has been discarded", () => {
    const asked: string[] = [];
    const pick = (state: GameState): readonly string[] => {
      if (state.pendingChoice?.prompt.kind === "orderLoopKeywords") asked.push("asked");
      return defaultPick(state);
    };
    const { state, events } = play(game(DECKHAND, [MATE]), LOOP, pick);
    const deckhand = idOf(state, DECKHAND);
    const resolvedAt = events.findIndex((e) => e.type === "keywordResolved" && e.instanceId === deckhand);
    expect(resolvedAt).toBeGreaterThan(discards(events)[2]!);
    expect(asked).toEqual([]);
    expect(damageOn(state)).toBe(1);
  });
});
