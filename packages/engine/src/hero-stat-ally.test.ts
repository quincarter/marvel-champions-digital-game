/**
 * docs/phase7-wave7.md §3.25 items 3–5: an encounter-set ally reading "[star] The Ward's base THW and base ATK are equal
 * to the THW and ATK of your hero. If the Ward leaves play, the players lose the game.", and a scheme reading "Forced
 * Interrupt: When the villain attacks, he attacks the Ward instead. (Other characters may defend the attack.)".
 * Synthetic cards only. Items 1–2 (entering play, control following the token) are `first-player-setup-ally.test.ts`.
 *
 * Sources and the readings pinned here:
 * - RRG 1.8 "Star Icon" (pp. 40–41): "that value is defined in that card's text. If it is not defined … that value is
 *   treated as 0"; ruling January 17, 2026 - Ruling 1: "the value of a star icon is defined by its associated ability
 *   (defaulting to 0 only when there is no associated ability)", and an effect copying this ally's base stats "adds
 *   your hero's power values". "Base Value" (p. 10): "A defined value before modifiers are applied"; "Modifiers"
 *   (p. 29): a quantity is recalculated from "the unmodified base value and all active modifiers". So the ally's base
 *   is its controller's hero's THW and ATK as they stand now (the hero's own modifiers included: "your hero's basic
 *   powers", not "printed"), and modifiers on the ally apply on top.
 * - Owner decision §4.1 Q14 = B: while the controller is in alter-ego form no hero is in play, the star is undefined,
 *   and THW and ATK are 0, whatever modifies the identity card.
 * - RRG 1.8 "Leaves Play" (p. 27): "any time when a card transitions from an in-play area to an out-of-play area".
 *   `RuleSpec leavingPlayLoses` (docs/phase7-wave4.md §3.8) is read as the card moves, so the loss comes with the move:
 *   after every "when it leaves play" interrupt (docs/phase7-wave5.md §4.1 Q17: interrupts resolve before the card
 *   moves), and not at all when a replacement leaves the card in play. A change of controller moves it between two
 *   play areas, which is not leaving play ("Ownership and Control", p. 31).
 * - RRG 1.8 "Attack (Enemy Activation)" (pp. 8–10): an ability can "cause an enemy to attack … an ally that player
 *   controls", and "the player is still considered attacked". Owner decisions §4.1 Q16 = A (once the attack goes to
 *   the ally, its controller is the attacked player, whoever it was first aimed at) and Q5 = A ("attacks you"
 *   abilities resolve against the attacked player when their ally is attacked). `retargetAttack` (§3.9) already does
 *   this; nothing in the engine changed for it.
 */

import { flat, type AllyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec, StatModifierSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, baseStat, characterProfile, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const named = (name: string): TargetRef => ({ kind: "named", name });
const wardRef = named("Ward");
const yourHero: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const inHeroForm = { kind: "form", player: { kind: "controller" }, form: "hero" } as const;

/** "[star] The Ward's base THW and base ATK are equal to the THW and ATK of your hero." */
const fromHero = (stat: "atk" | "thw"): StatModifierSpec => ({
  stat,
  amount: { kind: "stat", of: yourHero, stat },
  target: { self: true },
  while: inHeroForm,
  setBase: true,
});
const loses: RuleSpec = { kind: "leavingPlayLoses", target: { self: true } };
const WARD_STATS = stubAbility("ward.stats", {
  trigger: { kind: "constant", modifiers: [fromHero("thw"), fromHero("atk")] },
  effects: [],
});
const WARD_LOSS = stubAbility("ward.loss", { trigger: { kind: "constant", rules: [loses] }, effects: [] });
const WARD_CONTROL = stubAbility("ward.control", {
  trigger: { kind: "constant", rules: [{ kind: "controlledByFirstPlayer", target: { self: true } }] },
  effects: [],
});
/** "Interrupt: When the Ward leaves play, …": marks the villain, and records whether the Ward is still in play. */
const WARD_FAREWELL = stubAbility("ward.farewell", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    { kind: "addCounters", target: { kind: "villain" }, counterType: "farewell", amount: n(1) },
    {
      kind: "addCounters",
      target: { kind: "villain" },
      counterType: "stillInPlay",
      amount: { kind: "count", query: { name: "Ward", controller: "any" } },
    },
  ],
});
/** Printed star values (0 in the card data), 4 hit points, 1 consequential damage to attack and 2 to thwart. */
const wardLike = (id: string, abilities: AllyCard["abilities"]): AllyCard => ({
  ...stubAlly({
    id,
    cost: 0,
    atk: 0,
    thw: 0,
    hp: 4,
    consequentialAttack: 1,
    consequentialThwart: 2,
    keywords: [{ name: "setup" }],
    abilities,
  }),
  name: "Ward",
  unique: true,
  cardBack: "encounter",
});
const WARD = wardLike("ward", [WARD_CONTROL.ref, WARD_STATS.ref, WARD_LOSS.ref]);
/** The same ally without "The first player controls …": it stays with the player setup gave it to. */
const STAY = wardLike("stay", [WARD_STATS.ref, WARD_LOSS.ref]);
/** The same ally with a "when this leaves play" interrupt of its own. */
const VOCAL = wardLike("vocal", [WARD_CONTROL.ref, WARD_STATS.ref, WARD_LOSS.ref, WARD_FAREWELL.ref]);

const constant = (id: string, modifier: StatModifierSpec) =>
  stubAbility(id, { trigger: { kind: "constant", modifiers: [modifier] }, effects: [] });
/** "Your hero gets +1 ATK." Written against the identity card, so it also reaches an alter-ego's (unused) ATK. */
const EDGE_RULE = constant("edge.constant", {
  stat: "atk",
  amount: 1,
  target: { categories: ["identity"], controller: "you" },
});
const EDGE = stubSupport({ id: "edge", cost: 0, abilities: [EDGE_RULE.ref] });
/** "Your hero gets +2 THW." */
const BRACE_RULE = constant("brace.constant", {
  stat: "thw",
  amount: 2,
  target: { categories: ["identity"], controller: "you" },
});
const BRACE = stubSupport({ id: "brace", cost: 0, abilities: [BRACE_RULE.ref] });
/** "The Ward gets +1 THW." */
const BANNER_RULE = constant("banner.constant", {
  stat: "thw",
  amount: 1,
  target: { name: "Ward", controller: "any" },
});
const BANNER = stubSupport({ id: "banner", cost: 0, abilities: [BANNER_RULE.ref] });

/** "Forced Interrupt: When an ally would leave play, heal 1 damage from it instead." It stays in play. */
const HOLD_RULE = stubAbility("hold.replacement", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [
    { kind: "replaceTriggeringEvent", with: [{ kind: "heal", target: { kind: "eventTarget" }, amount: n(1) }] },
  ],
});
const HOLD = stubSupport({ id: "hold", cost: 0, abilities: [HOLD_RULE.ref] });
/** "Forced Interrupt: When an ally would leave play, remove it from the game instead." It still leaves play. */
const BANISH_RULE = stubAbility("banish.replacement", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "removedFromGame" }],
    },
  ],
});
const BANISH = stubSupport({ id: "banish", cost: 0, abilities: [BANISH_RULE.ref] });
/** A side scheme reading "The Ward cannot leave play." */
const ANCHOR_RULE = stubAbility("anchor.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: { name: "Ward", controller: "any" } }] },
  effects: [],
});
const ANCHOR = stubSideScheme({ id: "anchor", startingThreat: 5, abilities: [ANCHOR_RULE.ref] });

/** "Forced Interrupt: When the villain attacks, he attacks the Ward instead. (Other characters may defend the attack.)" */
const SNARE_RULE = stubAbility("snare.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "retargetAttack", character: wardRef }],
});
const SNARE = stubSideScheme({ id: "snare", startingThreat: 5, abilities: [SNARE_RULE.ref] });
/** "Boost: Deal 1 damage to you." No boost icons. */
const STING_BOOST = stubAbility("sting.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "dealDamage", target: yourHero, amount: n(1) }],
});
const STING = stubTreachery({ id: "sting", boostIcons: 0, abilities: [STING_BOOST.ref] });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(20), atk: 3, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "ward-scheme",
  stages: [{ startingThreat: flat(6), targetThreat: flat(99), acceleration: flat(0) }],
});

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const wardStat = (stat: "atk" | "thw", how: "base" | "printed" | "current"): ValueSpec => ({
  kind: "stat",
  of: wardRef,
  stat,
  ...(how === "base" ? { base: true as const } : how === "printed" ? { printed: true as const } : {}),
});
const record = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "villain" },
  counterType,
  amount,
});
/** "Copy the Ward's base ATK and THW": records them on the villain, with the printed and current values beside them. */
const COPY = action("copy", [
  record("baseAtk", wardStat("atk", "base")),
  record("baseThw", wardStat("thw", "base")),
  record("printedAtk", wardStat("atk", "printed")),
  record("printedThw", wardStat("thw", "printed")),
  record("atk", wardStat("atk", "current")),
  record("thw", wardStat("thw", "current")),
]);
const HURT = action("hurt", [{ kind: "dealDamage", target: wardRef, amount: n(1) }]);
const SMASH = action("smash", [{ kind: "dealDamage", target: wardRef, amount: n(4) }]);
const DISCARD = action("discard", [{ kind: "discardFromPlay", target: wardRef }]);
const RECALL = action("recall", [
  { kind: "takeIntoHand", cards: { kind: "ref", ref: wardRef }, player: { kind: "controller" } },
]);
const BURY = action("bury", [{ kind: "moveCards", cards: { kind: "ref", ref: wardRef }, to: "encounterDeckShuffle" }]);
const ERASE = action("erase", [{ kind: "moveCards", cards: { kind: "ref", ref: wardRef }, to: "removedFromGame" }]);
const SHIELD = action("shield", [{ kind: "giveStatus", target: wardRef, status: "tough" }]);
/** Defeats the identity of the player who plays it. */
const DOOM = action("doom", [{ kind: "dealDamage", target: yourHero, amount: n(50) }]);
/** "The villain attacks you." */
const GOAD = action("goad", [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }]);
const ACTIONS = [COPY, HURT, SMASH, DISCARD, RECALL, BURY, ERASE, SHIELD, DOOM, GOAD];
const SUPPORTS = [EDGE, BRACE, BANNER, HOLD, BANISH];

const deps: EngineDeps = depsOf(
  WARD_STATS,
  WARD_LOSS,
  WARD_CONTROL,
  WARD_FAREWELL,
  EDGE_RULE,
  BRACE_RULE,
  BANNER_RULE,
  HOLD_RULE,
  BANISH_RULE,
  ANCHOR_RULE,
  SNARE_RULE,
  STING_BOOST,
  ...ACTIONS.map((a) => a.ability),
);
const CARDS = [WARD, STAY, VOCAL, ANCHOR, SNARE, STING, SCHEME, ...SUPPORTS, ...ACTIONS.map((a) => a.card)];
const DECK: readonly CardId[] = [...SUPPORTS.map((s) => s.id), ...ACTIONS.map((a) => a.card.id)];

function start(players: 1 | 2, encounter: readonly CardId[] = [WARD.id]): GameState {
  return gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: BOSS,
    mainScheme: SCHEME,
    encounter: [...encounter, ...copiesOf(STING.id, 30)],
    deck: DECK,
    players,
  });
}

const wardOf = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => state.cardPool[i.cardId]?.name === "Ward")!.instanceId;
const heroOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });
const flip = (player: PlayerId): Command => ({ type: "changeForm", playerId: player });
/** The Ward's THW and ATK as the rules read them now. */
const stats = (state: GameState) => {
  const profile = characterProfile(state, wardOf(state), deps)!;
  return { thw: profile.thw, atk: profile.atk };
};

function drive(state: GameState | GameSession, commands: readonly Command[], pick = defaultPick) {
  const prompts: NonNullable<GameState["pendingChoice"]>[] = [];
  const session = "log" in state ? state : startSession(state);
  const result = driveSession(session, deps, commands, (current) => {
    if (current.pendingChoice) prompts.push(current.pendingChoice);
    return pick(current);
  });
  return { session: result.session, state: result.session.state, events: result.events, prompts };
}
/** `player` plays `card` from their deck for free (test surgery puts it in hand). */
function play(state: GameState, card: CardId, player: PlayerId = P1, pick = defaultPick) {
  const given = giveCard(state, player, card);
  return drive(
    given.state,
    [{ type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
}
const inPlay = (state: GameState, card: CardId, player: PlayerId = P1): GameState =>
  playerCardIntoPlay(state, card, player).state;
function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
const ended = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "gameEnded" }> => e.type === "gameEnded");
/** The game is lost because the Ward left play: the outcome, the log line and the step all say so, naming the card. */
function expectLostBy(result: ReturnType<typeof drive>, ward: InstanceId): void {
  const outcome = { result: "loss", reason: "cardAbility", sourceInstanceId: ward };
  expect(result.state.outcome).toEqual(outcome);
  expect(ended(result.events)).toEqual([{ type: "gameEnded", outcome }]);
  expect(result.state.step).toEqual({ phase: "gameOver", kind: "gameOver" });
  expect(locateCard(result.state, ward)?.kind).not.toBe("playArea");
  expectReplays(result.session);
}
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

describe("§3.25 item 3: base THW and ATK equal to the THW and ATK of the controller's hero", () => {
  it("hero THW 2, ATK 2: the ally is 2 / 2, and its base values are the hero's, not the printed 0", () => {
    const state = drive(start(1), [flip(P1)]).state;
    expect(stats(state)).toEqual({ thw: 2, atk: 2 });
    expect(baseStat(state, wardOf(state), "thw", deps)).toBe(2);
    expect(baseStat(state, wardOf(state), "atk", deps)).toBe(2);
  });

  it("a +1 ATK modifier on the hero is in the ally's base: 2 / 3", () => {
    const state = drive(inPlay(start(1), EDGE.id), [flip(P1)]).state;
    expect(characterProfile(state, heroOf(state, P1), deps)).toMatchObject({ thw: 2, atk: 3 });
    expect(stats(state)).toEqual({ thw: 2, atk: 3 });
    expect(baseStat(state, wardOf(state), "atk", deps)).toBe(3);
  });

  it("a +1 THW modifier on the ally itself applies on top of the base: 3 / 2, base THW still 2", () => {
    const state = drive(inPlay(start(1), BANNER.id), [flip(P1)]).state;
    expect(stats(state)).toEqual({ thw: 3, atk: 2 });
    expect(baseStat(state, wardOf(state), "thw", deps)).toBe(2);
    expect(characterProfile(state, heroOf(state, P1), deps)).toMatchObject({ thw: 2, atk: 2 });
  });

  it("both at once: hero +1 ATK, ally +1 THW: 3 / 3", () => {
    const state = drive(inPlay(inPlay(start(1), EDGE.id), BANNER.id), [flip(P1)]).state;
    expect(stats(state)).toEqual({ thw: 3, atk: 3 });
  });

  it("Q14 = B: 0 / 0 while the controller is in alter-ego form, the hero's values once they flip, 0 / 0 again after", () => {
    // The +1 ATK is written against the identity card: it must not leak through an alter-ego's ATK of 0.
    const state = inPlay(start(1), EDGE.id);
    expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
    expect(stats(state)).toEqual({ thw: 0, atk: 0 });
    expect(baseStat(state, wardOf(state), "atk", deps)).toBe(0);
    const hero = drive(state, [flip(P1)]);
    expect(stats(hero.state)).toEqual({ thw: 2, atk: 3 });
    // Round 2 (the villain's attack on the hero is retargeted by nothing here): back to alter-ego.
    const back = drive(hero.session, [endTurn(P1), flip(P1)]);
    expect(back.state.round).toBe(2);
    expect(mustPlayer(back.state, P1).identity.form).toBe("alterEgo");
    expect(stats(back.state)).toEqual({ thw: 0, atk: 0 });
    expectReplays(back.session);
  });

  it("a modifier on the ally still applies in alter-ego form: 0 base, +1 THW", () => {
    const state = inPlay(start(1), BANNER.id);
    expect(stats(state)).toEqual({ thw: 1, atk: 0 });
  });

  it("after control passes with the token, the values are the new controller's hero's", () => {
    // P1's hero: THW 2, ATK 3. P2's hero: THW 4, ATK 2.
    const state = inPlay(inPlay(start(2), EDGE.id, P1), BRACE.id, P2);
    const round1 = drive(state, [flip(P1)]);
    expect(mustInstance(round1.state, wardOf(state)).controllerId).toBe(P1);
    expect(stats(round1.state)).toEqual({ thw: 2, atk: 3 });
    const p2Turn = drive(round1.session, [endTurn(P1), flip(P2)]);
    // Still P1's ally during P2's turn of round 1, whatever form P2 is in.
    expect(stats(p2Turn.state)).toEqual({ thw: 2, atk: 3 });
    const round2 = drive(p2Turn.session, [endTurn(P2)]);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(mustInstance(round2.state, wardOf(state)).controllerId).toBe(P2);
    expect(stats(round2.state)).toEqual({ thw: 4, atk: 2 });
    // The new controller flips down: 0 / 0, although the old controller's hero is still in play.
    const down = drive(round2.session, [flip(P2)]);
    expect(mustPlayer(down.state, P1).identity.form).toBe("hero");
    expect(stats(down.state)).toEqual({ thw: 0, atk: 0 });
  });

  it("after its controller is eliminated, the values are the next player's hero's", () => {
    const state = inPlay(start(2), BRACE.id, P2);
    const hero = drive(state, [flip(P1)]);
    expect(stats(hero.state)).toEqual({ thw: 2, atk: 2 });
    const gone = play(hero.state, DOOM.card.id, P1);
    expect(gone.state.outcome).toBeNull();
    expect(mustInstance(gone.state, wardOf(state)).controllerId).toBe(P2);
    // P2 is in alter-ego form until their turn.
    expect(stats(gone.state)).toEqual({ thw: 0, atk: 0 });
    const p2 = drive(gone.session, [endTurn(P1), flip(P2)]);
    expect(stats(p2.state)).toEqual({ thw: 4, atk: 2 });
  });

  it("an effect copying its base stats reads the hero-derived numbers; its printed stats read 0 (ruling Jan 17, 2026 (1) #1)", () => {
    const state = drive(inPlay(inPlay(start(1), EDGE.id), BANNER.id), [flip(P1)]).state;
    const copied = play(state, COPY.card.id);
    // `addCounters` of 0 records nothing: the printed values are absent.
    expect(mustInstance(copied.state, villainOf(state)).counters).toEqual({
      baseAtk: 3,
      baseThw: 2,
      atk: 3,
      thw: 3,
    });
    expectReplays(copied.session);
  });

  it("the same copy in alter-ego form reads a base of 0", () => {
    const copied = play(inPlay(inPlay(start(1), EDGE.id), BANNER.id), COPY.card.id);
    expect(mustInstance(copied.state, villainOf(copied.state)).counters).toEqual({ thw: 1 });
  });

  it("it attacks for the hero's ATK and takes its own printed consequential damage (1)", () => {
    const state = drive(inPlay(start(1), EDGE.id), [flip(P1)]).state;
    const ward = wardOf(state);
    const attacked = drive(state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: ward, targetInstanceId: villainOf(state) },
    ]);
    expect(mustInstance(attacked.state, villainOf(state)).damage).toBe(3);
    expect(mustInstance(attacked.state, ward)).toMatchObject({ exhausted: true, damage: 1 });
    expect(mustInstance(attacked.state, heroOf(state, P1)).damage).toBe(0);
    expectReplays(attacked.session);
  });

  it("it thwarts for the hero's THW (+1 on itself) and takes its own printed consequential damage (2)", () => {
    const state = drive(inPlay(start(1), BANNER.id), [flip(P1)]).state;
    const ward = wardOf(state);
    const scheme = state.mainScheme.instanceId;
    const thwarted = drive(state, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ward, schemeInstanceId: scheme },
    ]);
    expect(mustInstance(state, scheme).threat).toBe(6);
    expect(mustInstance(thwarted.state, scheme).threat).toBe(3);
    expect(mustInstance(thwarted.state, ward)).toMatchObject({ exhausted: true, damage: 2 });
  });
});

describe("§3.25 item 4: 'If the Ward leaves play, the players lose the game.'", () => {
  it("defeated at 0 hit points: lost, the outcome naming the card", () => {
    const state = start(1);
    const ward = wardOf(state);
    const result = play(state, SMASH.card.id);
    expectLostBy(result, ward);
    expect(locateCard(result.state, ward)).toEqual({ kind: "encounterDiscard", deckId: activeEncounterDeckId(state) });
  });

  it("defeated by its own consequential damage", () => {
    const state = drive(start(1), [flip(P1)]).state;
    const ward = wardOf(state);
    // 2 damage on it, then a thwart: 2 consequential damage, 4 of 4.
    const hurt = play(play(state, HURT.card.id).state, HURT.card.id);
    expect(hurt.state.outcome).toBeNull();
    const result = drive(hurt.state, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ward, schemeInstanceId: state.mainScheme.instanceId },
    ]);
    expectLostBy(result, ward);
    // The thwart resolved first: THW 2 off the 6 threat.
    expect(mustInstance(result.state, state.mainScheme.instanceId).threat).toBe(4);
  });

  it("discarded from play", () => {
    const state = start(1);
    const result = play(state, DISCARD.card.id);
    expectLostBy(result, wardOf(state));
    expect(locateCard(result.state, wardOf(state))?.kind).toBe("encounterDiscard");
  });

  it("taken into a hand", () => {
    const state = start(1);
    const result = play(state, RECALL.card.id);
    expectLostBy(result, wardOf(state));
    expect(locateCard(result.state, wardOf(state))).toEqual({ kind: "hand", playerId: P1 });
  });

  it("shuffled into the encounter deck", () => {
    const state = start(1);
    const result = play(state, BURY.card.id);
    expectLostBy(result, wardOf(state));
    expect(locateCard(result.state, wardOf(state))?.kind).toBe("encounterDeck");
  });

  it("removed from the game", () => {
    const state = start(1);
    const result = play(state, ERASE.card.id);
    expectLostBy(result, wardOf(state));
    expect(locateCard(result.state, wardOf(state))?.kind).toBe("removedFromGame");
  });

  it("its controller eliminated while another player remains (no control rule to carry it over): it is discarded, lost", () => {
    const state = start(2, [STAY.id]);
    const stay = wardOf(state);
    expect(mustInstance(state, stay).controllerId).toBe(P1);
    // Round 2: P2 is the first player, and the ally is still P1's.
    const p1Turn = drive(state, [endTurn(P1), endTurn(P2), endTurn(P2)]);
    expect(p1Turn.state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
    expect(p1Turn.state.outcome).toBeNull();
    const result = play(p1Turn.state, DOOM.card.id, P1);
    expect(mustPlayer(result.state, P2).eliminated).toBe(false);
    expectLostBy(result, stay);
  });

  it("the last player eliminated: the game is lost with every player defeated, and that is the reason recorded", () => {
    // The ally is discarded in the last player's cleanup (RRG 1.8 "Player Elimination", p. 34, step 3), with nobody
    // left to play on: the loss is the elimination's (`first-player-setup-ally.test.ts` pins the same outcome).
    const state = start(1);
    const result = play(state, DOOM.card.id, P1);
    expect(result.state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
    expect(ended(result.events)).toHaveLength(1);
    expect(locateCard(result.state, wardOf(state))?.kind).toBe("encounterDiscard");
  });

  it("a change of controller is not leaving play: the token passes, and the game goes on", () => {
    const state = start(2);
    const ward = wardOf(state);
    const round2 = drive(state, [endTurn(P1), endTurn(P2)]);
    expect(round2.state.firstPlayerId).toBe(P2);
    expect(round2.events).toContainEqual(
      expect.objectContaining({ type: "controllerChanged", instanceId: ward, from: P1, to: P2 }),
    );
    expect(locateCard(round2.state, ward)).toEqual({ kind: "playArea", playerId: P2 });
    expect(round2.state.outcome).toBeNull();
    expect(ended(round2.events)).toEqual([]);
  });

  it("nor is its first-player controller's elimination, which hands it to the next player", () => {
    const state = start(2);
    const gone = play(state, DOOM.card.id, P1);
    expect(mustPlayer(gone.state, P1).eliminated).toBe(true);
    expect(locateCard(gone.state, wardOf(state))).toEqual({ kind: "playArea", playerId: P2 });
    expect(gone.state.outcome).toBeNull();
  });

  it("damage short of its hit points does not lose", () => {
    const hurt = play(start(1), HURT.card.id);
    expect(mustInstance(hurt.state, wardOf(hurt.state)).damage).toBe(1);
    expect(hurt.state.outcome).toBeNull();
  });

  it("a tough status card prevents the lethal damage, so nothing leaves and nothing is lost", () => {
    const state = start(1);
    const ward = wardOf(state);
    const result = play(play(state, SHIELD.card.id).state, SMASH.card.id);
    expect(mustInstance(result.state, ward)).toMatchObject({ damage: 0, statuses: { tough: 0 } });
    expect(locateCard(result.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expect(result.state.outcome).toBeNull();
  });

  it("a replacement that keeps it in play prevents the loss", () => {
    const state = inPlay(play(start(1), HURT.card.id).state, HOLD.id);
    const ward = wardOf(state);
    const result = play(state, DISCARD.card.id);
    expect(locateCard(result.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(result.state, ward).damage).toBe(0);
    expect(result.state.outcome).toBeNull();
    expect(ended(result.events)).toEqual([]);
    expectReplays(result.session);
  });

  it("a replacement that sends it somewhere else out of play does not: it still left play", () => {
    const state = inPlay(start(1), BANISH.id);
    const result = play(state, DISCARD.card.id);
    expectLostBy(result, wardOf(state));
    expect(locateCard(result.state, wardOf(state))?.kind).toBe("removedFromGame");
  });

  it("'cannot leave play' blocks the discard, and the loss with it", () => {
    const state = encounterCardInVillainArea(start(1, [WARD.id, ANCHOR.id]), ANCHOR.id, 5).state;
    const ward = wardOf(state);
    const result = play(state, DISCARD.card.id);
    expect(result.events).toContainEqual({ type: "leavePlayBlocked", instanceId: ward, reason: "cannotLeavePlay" });
    expect(locateCard(result.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    expect(result.state.outcome).toBeNull();
  });

  it("order: its own 'when this leaves play' interrupt resolves first, with it in play and the game not yet lost", () => {
    const state = start(1, [VOCAL.id]);
    const vocal = wardOf(state);
    const result = play(state, DISCARD.card.id);
    expectLostBy(result, vocal);
    // The interrupt resolved in full, and saw the card still in play (docs/phase7-wave5.md §4.1 Q17).
    expect(mustInstance(result.state, villainOf(state)).counters).toEqual({ farewell: 1, stillInPlay: 1 });
    const index = (match: (e: GameEvent) => boolean) => result.events.findIndex(match);
    const interrupt = index((e) => e.type === "counterAdded" && e.counterType === "stillInPlay");
    const moved = index((e) => e.type === "cardMoved" && e.instanceId === vocal && e.from.kind === "playArea");
    const lost = index((e) => e.type === "gameEnded");
    expect(interrupt).toBeGreaterThan(-1);
    expect(interrupt).toBeLessThan(moved);
    // The loss is recorded with the move, after it.
    expect(moved).toBeLessThan(lost);
  });
});

describe("§3.25 item 5: 'When the villain attacks, he attacks the Ward instead.' (retargetAttack; Q16 = A, Q5 = A)", () => {
  /** Two players, the redirect scheme in play, P1 (first player, the Ward's controller) and P2 in hero form, P2's turn. */
  function p2Turn(): { readonly state: GameState; readonly ward: InstanceId; readonly snare: InstanceId } {
    const snared = encounterCardInVillainArea(start(2, [WARD.id, SNARE.id]), SNARE.id, 5);
    const turn = drive(snared.state, [flip(P1), endTurn(P1), flip(P2)]);
    expect(turn.state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    expect(turn.state.firstPlayerId).toBe(P1);
    return { state: turn.state, ward: wardOf(turn.state), snare: snared.id };
  }
  const choosing =
    (defender: (state: GameState) => string, askedOf: PlayerId[] = [], offered: string[][] = []) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "declareDefender") return defaultPick(state);
      askedOf.push(choice.playerId);
      offered.push(choice.options.map((o) => o.optionId));
      return [defender(state)];
    };

  it("an attack aimed at P2 goes to the Ward: P1 is the attacked player, and undefended damage lands on the Ward", () => {
    const { state, ward } = p2Turn();
    const askedOf: PlayerId[] = [];
    const offered: string[][] = [];
    const result = play(
      state,
      GOAD.card.id,
      P2,
      choosing(() => "decline", askedOf, offered),
    );
    expect(result.events.filter((e) => e.type === "attackRetargeted")).toEqual([
      { type: "attackRetargeted", enemyInstanceId: villainOf(state), targetInstanceId: ward, playerId: P1 },
    ]);
    // The Ward's controller decides the defense, and any player's ready hero may be declared (RRG p. 15).
    expect(askedOf).toEqual([P1]);
    expect(offered[0]).toEqual(expect.arrayContaining(["decline", heroOf(state, P1), heroOf(state, P2)]));
    // ATK 3, no boost icons, undefended: 3 of the Ward's 4 hit points.
    expect(damageTo(result.events, ward)).toEqual([3]);
    expect(mustInstance(result.state, ward).damage).toBe(3);
    expect(locateCard(result.state, ward)).toEqual({ kind: "playArea", playerId: P1 });
    // "Boost: Deal 1 damage to you." is the attacked player's: P1, not the player the attack was first aimed at.
    expect(mustInstance(result.state, heroOf(state, P1)).damage).toBe(1);
    expect(mustInstance(result.state, heroOf(state, P2)).damage).toBe(0);
    expect(result.state.outcome).toBeNull();
    expectReplays(result.session);
  });

  it("another player's hero defends: the damage is theirs (3 - DEF 2), the Ward takes none, and so is the boost's 1", () => {
    const { state, ward } = p2Turn();
    const result = play(
      state,
      GOAD.card.id,
      P2,
      choosing((s) => heroOf(s, P2)),
    );
    // Declared by the attacked player (the event's `playerId`), with another player's hero.
    expect(result.events.filter((e) => e.type === "defenderDeclared")).toEqual([
      {
        type: "defenderDeclared",
        attackInstanceId: villainOf(state),
        defenderInstanceId: heroOf(state, P2),
        playerId: P1,
      },
    ]);
    // "Boost: Deal 1 damage to you." is the defending player's (RRG 1.8 "Defend, Defense", p. 16).
    expect(mustInstance(result.state, heroOf(state, P2))).toMatchObject({ damage: 2, exhausted: true });
    expect(mustInstance(result.state, ward).damage).toBe(0);
    expect(mustInstance(result.state, heroOf(state, P1)).damage).toBe(0);
    expectReplays(result.session);
  });

  it("the Ward's controller's hero defends: 3 - DEF 2 on them, plus the boost's 1", () => {
    const { state, ward } = p2Turn();
    const result = play(
      state,
      GOAD.card.id,
      P2,
      choosing((s) => heroOf(s, P1)),
    );
    expect(mustInstance(result.state, heroOf(state, P1))).toMatchObject({ damage: 2, exhausted: true });
    expect(mustInstance(result.state, ward).damage).toBe(0);
    expect(mustInstance(result.state, heroOf(state, P2)).damage).toBe(0);
  });

  it("an attack aimed at the Ward's own controller goes to the Ward as well", () => {
    const snared = encounterCardInVillainArea(start(2, [WARD.id, SNARE.id]), SNARE.id, 5);
    const state = drive(snared.state, [flip(P1)]).state;
    const result = play(state, GOAD.card.id, P1);
    expect(mustInstance(result.state, wardOf(state)).damage).toBe(3);
    expect(mustInstance(result.state, heroOf(state, P1)).damage).toBe(1);
  });

  it("lethal damage there loses the game", () => {
    const { state, ward } = p2Turn();
    const hurt = play(state, HURT.card.id, P2);
    expect(mustInstance(hurt.state, ward).damage).toBe(1);
    const result = play(hurt.state, GOAD.card.id, P2);
    expect(damageTo(result.events, ward)).toEqual([3]);
    expectLostBy(result, ward);
    expect(mustInstance(result.state, heroOf(state, P2)).damage).toBe(0);
  });

  it("without the scheme the same attack is P2's: their hero takes 3 and the boost's 1", () => {
    const turn = drive(start(2), [flip(P1), endTurn(P1), flip(P2)]);
    const result = play(turn.state, GOAD.card.id, P2);
    expect(result.events.some((e) => e.type === "attackRetargeted")).toBe(false);
    expect(mustInstance(result.state, heroOf(turn.state, P2)).damage).toBe(4);
    expect(mustInstance(result.state, heroOf(turn.state, P1)).damage).toBe(0);
    expect(mustInstance(result.state, wardOf(turn.state)).damage).toBe(0);
  });
});
