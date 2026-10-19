/**
 * docs/phase7-wave11-scenarios.md §S3.7 (engine task E7): villainous on a character that is not an enemy. RRG 1.8
 * "Villainous" (p. 47): "When a character with the villainous keyword uses a basic power, give it a facedown boost card
 * from the top of the encounter deck. When resolving that basic power, turn the boost card faceup, resolve any boost
 * ability on that card, and apply its boost icons to the character's stats for this use. Discard the boost card after
 * it is resolved." MC60 p. 26 FAQ (Black Cat 60169): "The rules for villainous have been revised to function for allies
 * (and heroes) who have it." Amplify adds nothing to it (RRG 1.8 "Amplify Icon", p. 7; §S4.0). Synthetic cards: an ally
 * printed with villainous, and a hero granted it.
 */

import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import type { LastingEffect } from "./lasting.js";
import { characterProfile, locateCard, mustInstance, mustPlayer } from "./query.js";
import { type GameState, NO_STATUSES } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";
import type { AbilityDefinition, EventPattern } from "./abilities.js";
import { defendPreview } from "./defend-preview.js";

/** "[star] Boost: Deal 1 damage to you." Two boost icons; "you" is whoever resolves it. */
const HURT_YOU = stubAbility("booster.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 1 },
    },
  ],
});
const BOOSTER = stubTreachery({ id: "booster", boostIcons: 2, starIcon: true, abilities: [HURT_YOU.ref] });
/** Two boost icons, no Boost ability. */
const PLAIN = stubTreachery({ id: "plain", boostIcons: 2 });
/** "[star] Boost: This card gets +2 boost icons." One printed. */
const ADJUST = stubAbility("adjuster.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 2 } }],
});
const ADJUSTER = stubTreachery({ id: "adjuster", boostIcons: 1, starIcon: true, abilities: [ADJUST.ref] });
/** "[star] Boost: Count the boost icons on the villain instead" (it has none). Two printed. */
const REPLACE = stubAbility("replacer.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "replaceBoostCount", card: { kind: "villain" } }],
});
const REPLACER = stubTreachery({ id: "replacer", boostIcons: 2, starIcon: true, abilities: [REPLACE.ref] });
/** "[star] Boost: Deal 5 damage to each ally." */
const MASSACRE = stubAbility("massacre.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["ally"] } },
      amount: { kind: "const", value: 5 },
    },
  ],
});
const MASSACRER = stubTreachery({ id: "massacrer", boostIcons: 2, starIcon: true, abilities: [MASSACRE.ref] });
const CAT = stubAlly({ id: "cat", cost: 0, atk: 1, thw: 1, hp: 5, keywords: [{ name: "villainous" }] });
/** ATK 1, THW 3: tells which stat a swapped attack reads. */
const SWAP_CAT = stubAlly({ id: "swap-cat", cost: 0, atk: 1, thw: 3, hp: 5, keywords: [{ name: "villainous" }] });
const PLAIN_ALLY = stubAlly({ id: "plain-ally", cost: 0, atk: 1, thw: 1, hp: 5 });
const VILLAINOUS_MINION = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 5, keywords: [{ name: "villainous" }] });

/** A support with one forced ability, put into play by the tests that need it. */
function watcher(
  id: string,
  on: EventPattern,
  effects: AbilityDefinition["effects"],
  timing: "interrupt" | "response" = "interrupt",
) {
  const ability = stubAbility(`${id}.ability`, { trigger: { kind: timing, forced: true, on }, effects });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
}
const mark = (counterType: string): AbilityDefinition["effects"] => [
  {
    kind: "addCounters",
    target: { kind: "each", query: { categories: ["mainScheme"] } },
    counterType,
    amount: { kind: "const", value: 1 },
  },
];
/** "When a boost card is turned faceup, cancel its boost icons" (Attacrobatics' shape, unqualified). */
const CANCEL_ICONS = watcher("cancel-icons", { on: "boostCardTurnedFaceup" }, [{ kind: "cancelBoostIcons" }]);
/** "When a boost card is turned faceup, cancel its Boost ability" (Target Acquired's effect, as an interrupt). */
const CANCEL_ABILITY = watcher("cancel-ability", { on: "boostCardTurnedFaceup" }, [{ kind: "cancelBoostAbility" }]);
/** "When a boost card is turned faceup during an attack". */
const DURING_ATTACK = watcher(
  "during-attack",
  { on: "boostCardTurnedFaceup", activation: "attack" },
  mark("duringAttack"),
);
/** "When a boost card is turned faceup while the villain attacks" (Preemptive Strike's qualifier). */
const VILLAIN_ONLY = watcher(
  "villain-only",
  { on: "boostCardTurnedFaceup", sourceIs: { categories: ["villain"] } },
  mark("villainOnly"),
);
/** "After a boost card is turned faceup": a response. */
const AFTER_TURNED = watcher("after-turned", { on: "boostCardTurnedFaceup" }, mark("afterTurned"), "response");
/** "When a character attacks, it uses its THW instead of its ATK" (the Befuddle-style `useThw` swap). */
const USE_THW = watcher("use-thw", { on: "attack" }, [{ kind: "modifyBasicPower", useStat: "thw" }]);
const WATCHERS = [CANCEL_ICONS, CANCEL_ABILITY, DURING_ATTACK, VILLAIN_ONLY, AFTER_TURNED, USE_THW];

const deps = depsOf(HURT_YOU, ADJUST, REPLACE, MASSACRE, ...WATCHERS.map((w) => w.ability));

/** P1's first turn in hero form, `ally` in play under P1, 5 threat on the main scheme. */
function start(encounter: readonly string[] = copiesOf(BOOSTER.id, 10)) {
  const base = gameAtFirstTurn({
    cards: [
      BOOSTER,
      PLAIN,
      ADJUSTER,
      REPLACER,
      MASSACRER,
      CAT,
      SWAP_CAT,
      PLAIN_ALLY,
      VILLAINOUS_MINION,
      ...WATCHERS.map((w) => w.card),
    ],
    deps,
    encounter: encounter as never,
    deck: [CAT.id, SWAP_CAT.id, PLAIN_ALLY.id, ...WATCHERS.map((w) => w.card.id)],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const scheme = hero.mainScheme!.instanceId;
  return {
    state: { ...hero, instances: { ...hero.instances, [scheme]: { ...mustInstance(hero, scheme), threat: 5 } } },
    scheme,
  };
}

function withAlly(state: GameState, card = CAT.id) {
  return playerCardIntoPlay(state, card, P1);
}

const run = (state: GameState, commands: readonly Command[], pick = defaultPick) => {
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { session, state: session.state, events };
};

const thwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});

const types = (events: readonly GameEvent[]) => events.map((e) => e.type);
const identity = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

const grantVillainous = (target: InstanceId): LastingEffect => ({
  id: "test.grant",
  kind: "keywordGrant",
  keyword: { name: "villainous" },
  targets: [target],
  affects: null,
  scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
  duration: { kind: "endOfRound" },
});

describe("a villainous ally's basic powers (RRG 1.8 'Villainous', p. 47; MC60 p. 26 FAQ)", () => {
  it("a basic thwart is given a boost card, turns it up, resolves its Boost for 'you' and adds its icons to THW", () => {
    const { state, scheme } = start();
    const ally = withAlly(state);
    const before = mustInstance(ally.state, identity(ally.state)).damage;
    const after = run(ally.state, [thwart(ally.id, scheme)]);

    // THW 1 + 2 boost icons.
    expect(mustInstance(after.state, scheme).threat).toBe(2);
    const dealt = after.events.find((e) => e.type === "boostCardDealt");
    expect(dealt).toMatchObject({ enemyInstanceId: ally.id, outsideActivation: true });
    const flipped = after.events.find((e) => e.type === "characterBoostCardFlipped");
    expect(flipped).toMatchObject({ characterInstanceId: ally.id, power: "thwart", stat: "thw", boostIcons: 2 });
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "keywordResolved", keyword: "villainous", instanceId: ally.id, playerId: P1 }),
    );
    // The give, then the flip, then the threat removed.
    const order = types(after.events);
    expect(order.indexOf("boostCardDealt")).toBeLessThan(order.indexOf("characterBoostCardFlipped"));
    expect(order.indexOf("characterBoostCardFlipped")).toBeLessThan(order.indexOf("threatRemoved"));
    // Its Boost ability resolved with the ally's controller as "you".
    expect(mustInstance(after.state, identity(after.state)).damage).toBe(before + 1);
    // Discarded to the encounter discard; nothing left on her; the bonus was for this use only.
    const boostId = (flipped as { instanceId: InstanceId }).instanceId;
    expect(locateCard(after.state, boostId)?.kind).toBe("encounterDiscard");
    expect(mustInstance(after.state, ally.id).boostCards).toEqual([]);
    expect(characterProfile(after.state, ally.id, deps)?.thw).toBe(1);
    // She still takes her consequential damage.
    expect(mustInstance(after.state, ally.id).damage).toBe(1);
    // The log replays to the same state.
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("a basic attack adds the icons to ATK", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(state);
    const villain = ally.state.villains[0]!.instanceId;
    const before = mustInstance(ally.state, villain).damage;
    const after = run(ally.state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally.id, targetInstanceId: villain },
    ]);
    // ATK 1 + 2 boost icons.
    expect(mustInstance(after.state, villain).damage).toBe(before + 3);
    expect(after.events.find((e) => e.type === "characterBoostCardFlipped")).toMatchObject({
      power: "attack",
      stat: "atk",
    });
    expect(characterProfile(after.state, ally.id, deps)?.atk).toBe(1);
  });

  it("an ally without the keyword gets no boost card", () => {
    const { state, scheme } = start();
    const ally = withAlly(state, PLAIN_ALLY.id);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(mustInstance(after.state, scheme).threat).toBe(4);
    expect(types(after.events)).not.toContain("boostCardDealt");
    expect(types(after.events)).not.toContain("characterBoostCardFlipped");
  });

  it("a cancelled power is not used, so it gets no card: a confused ally's thwart", () => {
    const { state, scheme } = start();
    const ally = withAlly(state);
    const confused = {
      ...ally.state,
      instances: {
        ...ally.state.instances,
        [ally.id]: { ...mustInstance(ally.state, ally.id), statuses: { ...NO_STATUSES, confused: 1 } },
      },
    };
    const after = run(confused, [thwart(ally.id, scheme)]);
    expect(mustInstance(after.state, scheme).threat).toBe(5);
    expect(types(after.events)).not.toContain("boostCardDealt");
  });

  it("an ally's defense gets no boost card (RRG 1.8 p. 15, 'An ally can exhaust to defend'; p. 10, DEF)", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(state);
    const after = run(ally.state, [{ type: "endTurn", playerId: P1 }], (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? [ally.id] : defaultPick(s),
    );
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "defenderDeclared", defenderInstanceId: ally.id }),
    );
    expect(after.events.some((e) => e.type === "boostCardDealt" && e.enemyInstanceId === ally.id)).toBe(false);
    expect(types(after.events)).not.toContain("characterBoostCardFlipped");
  });
});

describe("a villainous hero (MC60 p. 26 FAQ: 'allies (and heroes)')", () => {
  it("a basic defense adds the icons to DEF for that attack", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const hero = identity(state);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    const pick = (s: GameState) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(s));
    const before = mustInstance(granted, hero).damage;
    const after = run(granted, [{ type: "endTurn", playerId: P1 }], pick);
    // Villain ATK 2 + 2 boost icons against DEF 2 + 2 boost icons: no damage.
    expect(after.events.find((e) => e.type === "characterBoostCardFlipped")).toMatchObject({
      characterInstanceId: hero,
      power: "defense",
      stat: "def",
      boostIcons: 2,
    });
    expect(mustInstance(after.state, hero).damage).toBe(before);

    // The same defense without the keyword takes 2.
    const plain = run(state, [{ type: "endTurn", playerId: P1 }], pick);
    expect(mustInstance(plain.state, hero).damage).toBe(before + 2);
  });

  it("a basic thwart by the hero is boosted as well", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const hero = identity(state);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    const after = run(granted, [thwart(hero, scheme)]);
    // THW 2 + 2.
    expect(mustInstance(after.state, scheme).threat).toBe(1);
  });
});

describe("the boost card comes off the top of the encounter deck", () => {
  it("the top card is the one given", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const topped = onTopOfEncounterDeck({ ...state }, PLAIN.id);
    const ally = withAlly(topped);
    const deck = topped.encounterDecks[Object.keys(topped.encounterDecks)[0]!]!.deck;
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(after.events.find((e) => e.type === "boostCardDealt")).toMatchObject({ instanceId: deck[0] });
  });
});

/** Each watcher's support put into P1's play area. */
function withWatchers(state: GameState, ...watchers: readonly (typeof WATCHERS)[number][]): GameState {
  let current = state;
  for (const w of watchers) current = playerCardIntoPlay(current, w.card.id, P1).state;
  return current;
}

const counter = (state: GameState, scheme: InstanceId, type: string): number =>
  mustInstance(state, scheme).counters[type] ?? 0;
const flippedId = (events: readonly GameEvent[]): InstanceId => {
  const flipped = events.find((e) => e.type === "characterBoostCardFlipped");
  if (flipped?.type !== "characterBoostCardFlipped") throw new Error("no character boost card turned up");
  return flipped.instanceId;
};
const attackVillain = (state: GameState, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: state.villains[0]!.instanceId,
});

describe("the card stays on the character until the use has resolved (RRG 1.8 p. 47; MC60 p. 3)", () => {
  it("is discarded after the threat is removed, not before", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(state);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    const boostId = flippedId(after.events);
    const removed = after.events.findIndex((e) => e.type === "threatRemoved");
    const discarded = after.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === boostId && e.to.kind === "encounterDiscard",
    );
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(discarded).toBeGreaterThan(removed);
    expect(locateCard(after.state, boostId)?.kind).toBe("encounterDiscard");
  });

  it("a character that leaves play mid-use takes the card to its discard pile; nothing moves it twice", () => {
    const { state, scheme } = start(copiesOf(MASSACRER.id, 10));
    const ally = withAlly(state);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    const boostId = flippedId(after.events);
    expect(locateCard(after.state, ally.id)?.kind).toBe("discard");
    expect(locateCard(after.state, boostId)?.kind).toBe("encounterDiscard");
    const moves = after.events.flatMap((e) => (e.type === "cardMoved" && e.instanceId === boostId ? [e.to.kind] : []));
    expect(moves).toEqual(["boost", "encounterDiscard"]);
    expect(after.state.stack).toEqual([]);
  });

  it("a facedown card held from before stays facedown; only the card this use gave is resolved (RRG 1.8 p. 11)", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(state);
    const deckId = Object.keys(ally.state.encounterDecks)[0] as keyof GameState["encounterDecks"];
    const piles = ally.state.encounterDecks[deckId]!;
    const held = piles.deck[0]!;
    const staged: GameState = {
      ...ally.state,
      encounterDecks: { ...ally.state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(1) } },
      instances: {
        ...ally.state.instances,
        [held]: { ...mustInstance(ally.state, held), faceup: false },
        [ally.id]: { ...mustInstance(ally.state, ally.id), boostCards: [held] },
      },
    };
    const after = run(staged, [thwart(ally.id, scheme)]);
    expect(after.events.filter((e) => e.type === "characterBoostCardFlipped")).toHaveLength(1);
    expect(flippedId(after.events)).not.toBe(held);
    expect(mustInstance(after.state, ally.id).boostCards).toEqual([held]);
    expect(mustInstance(after.state, held).faceup).toBe(false);
    expect(mustInstance(after.state, scheme).threat).toBe(2);
  });
});

describe("a stat swap after the icons were applied keeps them (RRG 1.8 p. 47; docs/phase7-wave8.md §4.1 Q54)", () => {
  it("an attack switched to THW adds the icons to THW", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(withWatchers(state, USE_THW), SWAP_CAT.id);
    const villain = ally.state.villains[0]!.instanceId;
    const before = mustInstance(ally.state, villain).damage;
    const after = run(ally.state, [attackVillain(ally.state, ally.id)]);
    // THW 3 + 2 boost icons: not ATK 1 + 2, nor THW 3 alone.
    expect(mustInstance(after.state, villain).damage).toBe(before + 5);
    expect(characterProfile(after.state, ally.id, deps)?.thw).toBe(3);
    expect(characterProfile(after.state, ally.id, deps)?.atk).toBe(1);
  });
});

describe("the 'boost card turned faceup' window opens for her card (RRG 1.8 p. 8 step 3a; p. 11)", () => {
  it("an unqualified 'cancel its boost icons' hears it", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(withWatchers(state, CANCEL_ICONS));
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "icons" }));
    expect(mustInstance(after.state, scheme).threat).toBe(4);
  });

  it("an unqualified 'cancel its Boost ability' hears it: the Boost does not resolve, the icons still count", () => {
    const { state, scheme } = start();
    const ally = withAlly(withWatchers(state, CANCEL_ABILITY));
    const before = mustInstance(ally.state, identity(ally.state)).damage;
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "ability" }));
    expect(mustInstance(after.state, identity(after.state)).damage).toBe(before);
    expect(mustInstance(after.state, scheme).threat).toBe(2);
  });

  it("'during an attack' hears her basic attack, not her thwart; a villain-qualified one hears neither", () => {
    const { state, scheme } = start(copiesOf(PLAIN.id, 10));
    const ally = withAlly(withWatchers(state, DURING_ATTACK, VILLAIN_ONLY, AFTER_TURNED));
    const attacked = run(ally.state, [attackVillain(ally.state, ally.id)]);
    expect(counter(attacked.state, scheme, "duringAttack")).toBe(1);
    expect(counter(attacked.state, scheme, "villainOnly")).toBe(0);
    expect(counter(attacked.state, scheme, "afterTurned")).toBe(1);

    const thwarted = run(ally.state, [thwart(ally.id, scheme)]);
    expect(counter(thwarted.state, scheme, "duringAttack")).toBe(0);
    expect(counter(thwarted.state, scheme, "villainOnly")).toBe(0);
    expect(counter(thwarted.state, scheme, "afterTurned")).toBe(1);
  });
});

describe("the card's own Boost ability changing its count", () => {
  it("'this card gets +2 boost icons' (adjustBoostCount): 1 printed + 2", () => {
    const { state, scheme } = start(copiesOf(ADJUSTER.id, 10));
    const ally = withAlly(state);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    // THW 1 + 3.
    expect(mustInstance(after.state, scheme).threat).toBe(1);
  });

  it("'count the villain's boost icons instead' (replaceBoostCount): 0", () => {
    const { state, scheme } = start(copiesOf(REPLACER.id, 10));
    const ally = withAlly(state);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(mustInstance(after.state, scheme).threat).toBe(4);
  });
});

describe("a villainous identity's basic recovery (RRG 1.8 p. 10: REC is a basic power; p. 47)", () => {
  it("heals REC 3 + 2 boost icons", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const id = identity(state);
    const alterEgo: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage: 7 } },
      lastingEffects: [...state.lastingEffects, grantVillainous(id)],
    };
    const after = run(alterEgo, [{ type: "basicRecover", playerId: P1 }]);
    expect(after.events.find((e) => e.type === "characterBoostCardFlipped")).toMatchObject({
      power: "recover",
      stat: "rec",
      boostIcons: 2,
    });
    expect(mustInstance(after.state, id).damage).toBe(2);
    expect(characterProfile(after.state, id, deps)?.rec).toBe(3);
  });
});

describe("a villainous minion is untouched (RRG 1.8 p. 8 step 1)", () => {
  it("its activation gets exactly one boost card and no character flip", () => {
    const { state } = start([VILLAINOUS_MINION.id, ...copiesOf(PLAIN.id, 10)]);
    const goon = minionEngagedWith(state, VILLAINOUS_MINION.id, P1);
    const after = run(goon.state, [{ type: "endTurn", playerId: P1 }]);
    expect(after.events.some((e) => e.type === "enemyActivated" && e.enemyInstanceId === goon.id)).toBe(true);
    expect(after.events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === goon.id)).toHaveLength(1);
    expect(types(after.events)).not.toContain("characterBoostCardFlipped");
  });
});

describe("a villainous hero's defense: its card is turned up after the enemy's (RRG 1.8 p. 9, steps 3-4)", () => {
  it("the enemy's boost card turns up first", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const hero = identity(state);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    const pick = (s: GameState) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(s));
    const after = run(granted, [{ type: "endTurn", playerId: P1 }], pick);
    const order = types(after.events);
    expect(order.indexOf("boostCardFlipped")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("boostCardFlipped")).toBeLessThan(order.indexOf("characterBoostCardFlipped"));
  });

  it("the defend preview shows the hero's own unseen card as a range", () => {
    const { state } = start(copiesOf(PLAIN.id, 10));
    const hero = identity(state);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    let preview: ReturnType<typeof defendPreview> = null;
    run(granted, [{ type: "endTurn", playerId: P1 }], (s) => {
      if (s.pendingChoice?.prompt.kind !== "declareDefender") return defaultPick(s);
      preview ??= defendPreview(s, deps);
      return [hero];
    });
    const options = preview as ReturnType<typeof defendPreview>;
    const option = options?.find((o) => o.defenderInstanceId === hero);
    expect(option?.ownBoost).toMatchObject({ facedownCount: 1, min: 2, max: 2 });
    // Villain ATK 2 + 2 against DEF 2 + 2: no damage.
    expect(option?.bands).toEqual([expect.objectContaining({ boostFrom: 0, boostTo: 0, damageDealt: 0 })]);
    expect(options?.find((o) => o.defenderInstanceId === null)?.ownBoost).toBeUndefined();
  });
});
