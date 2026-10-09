/**
 * docs/phase7-wave8.md §3.13: a lasting effect that ends "until the next villain phase begins" (`LastingUntil
 * "nextVillainPhaseBegins"`, `LastingDuration nextVillainPhaseBegins`), on the blank of an identity's text box. A
 * synthetic villain shaped like Pestilence ("Forced Response: After [this villain] attacks you, treat your identity's
 * text box as if it were blank (except for TRAITS) until the next villain phase begins") and an identity that prints
 * abilities on both faces, a keyword and a trait.
 *
 * Sources: RRG 1.8 "Lasting Effects" (p. 26: "A lasting effect expires as soon as the timing point specified by its
 * duration is reached"), "Text Box" (p. 44), "Traits" (p. 45), "Villain Phase" (p. 47), "End of Player Phase" (p. 18).
 * The identity semantics are the constant form's (`blank-text-box-identity.test.ts`, docs/phase7-wave7.md §4.1 Q12 = A).
 */

import { flat, trait, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { legalActions } from "./legal.js";
import { characterProfile, handSize, mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, textBoxBlankFor, traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, newGame, RESOURCE } from "./testing/scenario.js";
import { copiesOf, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AVENGER = trait("AVENGER");
const one = { kind: "const", value: 1 } as const;
/** One counter of this name on the identity, so each resolution is countable. */
const tally = (name: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType: name,
  amount: one,
});
const yours = { kind: "identityOf", player: { kind: "controller" } } as const;

/** "Forced Response: After an enemy attacks you, …" (the identity's own, in hero form). */
const SENSE = stubAbility(
  "seer.sense",
  def({
    trigger: {
      kind: "response",
      forced: true,
      form: "hero",
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [tally("sense")],
  }),
);
/** "Forced Response: After the player phase ends, …": still blank there. */
const DUSK = stubAbility(
  "seer.dusk",
  def({ trigger: { kind: "response", forced: true, on: { on: "playerPhaseEnded" } }, effects: [tally("dusk")] }),
);
/** "Forced Interrupt: When the villain phase begins, …": the blank is already gone there. */
const DAWN = stubAbility(
  "seer.dawn",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [tally("dawn")],
  }),
);
const HERO_ACTION = stubAbility(
  "seer.hero-action",
  def({ trigger: { kind: "action", form: "hero" }, effects: [tally("action")] }),
);
const ALTER_EGO_ACTION = stubAbility(
  "seer.alter-ego-action",
  def({ trigger: { kind: "action", form: "alterEgo" }, effects: [tally("action")] }),
);
const SEER: HeroIdentityCard = stubIdentity({
  id: "seer",
  hp: 30,
  atk: 2,
  thw: 2,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [SENSE.ref, DUSK.ref, DAWN.ref, HERO_ACTION.ref],
  alterEgoAbilities: [ALTER_EGO_ACTION.ref, DUSK.ref, DAWN.ref],
  heroKeywords: [{ name: "retaliate", value: 1 }],
  heroTraits: [AVENGER],
});

const blankYours: EffectSpec = { kind: "blankTextBox", target: yours, until: "nextVillainPhaseBegins" };
/** "Forced Response: After Plague attacks you, treat your identity's text box as blank until the next villain phase begins." */
const PLAGUE_FR = stubAbility(
  "plague.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [blankYours],
  }),
);
const PLAGUE = stubVillain({ id: "plague", stages: [{ hp: flat(60), atk: 1, sch: 1, abilities: [PLAGUE_FR.ref] }] });
/** A villain with no text, for the tests that make the blank themselves. */
const MUTE = stubVillain({ id: "mute", stages: [{ hp: flat(60), atk: 1, sch: 1 }] });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** The same blank, made in the player phase. */
const MIASMA = action("miasma", blankYours);
/** "Your identity gets +1 ATK until the next villain phase begins": the duration on another lasting effect. */
const VIGOR = action("vigor", {
  kind: "modifyStatUntil",
  stat: "atk",
  amount: one,
  target: yours,
  until: "nextVillainPhaseBegins",
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  SENSE,
  DUSK,
  DAWN,
  HERO_ACTION,
  ALTER_EGO_ACTION,
  PLAGUE_FR,
  MIASMA.ability,
  VIGOR.ability,
);

/** P1 at their first turn, in hero form, against `villain`; the encounter deck is blank treacheries. */
function start(villain = PLAGUE): GameState {
  const state = newGame({
    identity: SEER,
    villain,
    extraCards: [SEER, PLAGUE, MUTE, FILLER, MIASMA.card, VIGOR.card],
    encounterDeck: copiesOf(FILLER.id, 30),
    deck: [...copiesOf(RESOURCE.id, 30), ...copiesOf(MIASMA.card.id, 2), ...copiesOf(VIGOR.card.id, 2)],
    deps,
  });
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
}

const heroId = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const tallied = (state: GameState, name: string): number => mustInstance(state, heroId(state)).counters[name] ?? 0;
const blank = (state: GameState): boolean => textBoxBlankFor(state, heroId(state), deps);
const endTurn: Command = { type: "endTurn", playerId: P1 };
const playFromHand = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const canUse = (state: GameState, ability: StubAbility): boolean => {
  const actions = legalActions(state, P1, deps);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === ability.ref.id)
  );
};

/** Runs `commands` on a session, answering choices by default; returns the session to continue from. */
function run(from: GameState | GameSession, ...commands: readonly Command[]) {
  const session = "log" in from ? from : startSession(from);
  const driven = driveSession(session, deps, commands);
  return { session: driven.session, state: driven.session.state, events: driven.events };
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** The position of the first event of `type` matching `where`, or -1. */
const at = <T extends GameEvent["type"]>(
  events: readonly GameEvent[],
  type: T,
  where: (e: Extract<GameEvent, { type: T }>) => boolean = () => true,
) => events.findIndex((e) => e.type === type && where(e as Extract<GameEvent, { type: T }>));

describe("§3.13 a blank made in the villain phase lasts through the next player phase", () => {
  it("round 1: the villain attacks, its Forced Response blanks the identity, and the identity's own 'after an enemy attacks you' is not heard", () => {
    const round1 = run(start(), endTurn);
    expect(round1.state.round).toBe(2);
    expect(round1.state.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(of(round1.events, "attackResolved")).toHaveLength(1);
    // Both are "after it attacks you"; the villain's resolves and the identity is blank from then on. The forced
    // responses of one window resolve in the order the player picks, so the count is at most the one resolved first.
    expect(blank(round1.state)).toBe(true);
    expect(round1.state.lastingEffects).toMatchObject([
      { kind: "blankTextBox", targets: [heroId(round1.state)], duration: { kind: "nextVillainPhaseBegins" } },
    ]);
    // It outlived the end of the round it was made in.
    expect(at(round1.events, "roundStarted")).toBeGreaterThan(at(round1.events, "lastingEffectAdded"));
    expect(of(round1.events, "lastingEffectEnded")).toHaveLength(0);
  });

  it("round 2's player phase: every printed ability is off on both faces, the keyword is off; traits, stats, hit points and hand size are unchanged", () => {
    const base = start();
    const hero = heroId(base);
    const before = {
      profile: characterProfile(base, hero, deps),
      hand: handSize(base, P1, deps),
      traits: traitsOf(base, hero, deps),
    };
    expect(hasKeyword(base, hero, "retaliate", deps)).toBe(true);
    expect(canUse(base, HERO_ACTION)).toBe(true);

    const round1 = run(base, endTurn);
    const s = round1.state;
    expect(activeAbilityRefs(s, hero, deps)).toEqual([]);
    expect(canUse(s, HERO_ACTION)).toBe(false);
    expect(hasKeyword(s, hero, "retaliate", deps)).toBe(false);
    expect(traitsOf(s, hero, deps)).toEqual(before.traits);
    expect(traitsOf(s, hero, deps)).toContain(AVENGER);
    expect(characterProfile(s, hero, deps)).toEqual(before.profile);
    expect(handSize(s, P1, deps)).toBe(before.hand);

    // The blank is on the card: changing form restores nothing (docs/phase7-wave7.md §4.1 Q12 = A).
    const flipped = run(round1.session, { type: "changeForm", playerId: P1 });
    expect(mustPlayer(flipped.state, P1).identity.form).toBe("alterEgo");
    expect(blank(flipped.state)).toBe(true);
    expect(activeAbilityRefs(flipped.state, hero, deps)).toEqual([]);
    expect(canUse(flipped.state, ALTER_EGO_ACTION)).toBe(false);
  });

  it("it ends as round 2's villain phase begins: after the player phase's end has resolved (still blank) and before the phase beginning is answered and step one", () => {
    const round1 = run(start(), endTurn);
    const before = { dusk: tallied(round1.state, "dusk"), dawn: tallied(round1.state, "dawn") };
    const sense = tallied(round1.state, "sense");
    const round2 = run(round1.session, endTurn);

    const ended = at(round2.events, "lastingEffectEnded", (e) => e.reason === "expired");
    expect(ended).toBeGreaterThan(-1);
    // "After the player phase ends" on the identity was still blank: not resolved this round.
    expect(tallied(round2.state, "dusk")).toBe(before.dusk);
    // "When the villain phase begins" was read with the blank gone: resolved, after the expiry and before step one.
    expect(tallied(round2.state, "dawn")).toBe(before.dawn + 1);
    const dawn = at(round2.events, "abilityResolved", (e) => e.abilityId === DAWN.ref.id);
    const stepOne = at(round2.events, "threatPlaced");
    expect(dawn).toBeGreaterThan(ended);
    expect(stepOne).toBeGreaterThan(dawn);
    // In round 2's villain phase the identity's own ability is heard again when the villain attacks.
    expect(tallied(round2.state, "sense")).toBe(sense + 1);
    // …and the villain's Forced Response blanks it afresh for round 3's player phase.
    expect(blank(round2.state)).toBe(true);
    expect(round2.state.lastingEffects).toHaveLength(1);

    const replayed = replay(round2.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(round2.session.state);
  });
});

describe("§3.13 a blank made in the player phase ends when that round's villain phase begins", () => {
  it("made on the player's turn, it is gone before step one of the same round's villain phase", () => {
    const base = start(MUTE);
    const given = giveCard(base, P1, MIASMA.card.id);
    const played = run(given.state, playFromHand(given.id));
    expect(blank(played.state)).toBe(true);
    expect(canUse(played.state, HERO_ACTION)).toBe(false);

    const ended = run(played.session, endTurn);
    expect(blank(ended.state)).toBe(false);
    expect(ended.state.lastingEffects).toEqual([]);
    const expired = at(ended.events, "lastingEffectEnded", (e) => e.reason === "expired");
    expect(expired).toBeGreaterThan(-1);
    expect(at(ended.events, "threatPlaced")).toBeGreaterThan(expired);
    // The villain's attack in step two is heard by the identity again.
    expect(tallied(ended.state, "sense")).toBe(1);
    expect(tallied(ended.state, "dawn")).toBe(1);
    expect(tallied(ended.state, "dusk")).toBe(0);
  });

  it("a second blank made in round 2's player phase ends at the same moment as the first, from round 1's villain phase", () => {
    const round1 = run(start(), endTurn);
    const given = giveCard(round1.state, P1, MIASMA.card.id);
    const second = run(startSession(given.state), playFromHand(given.id));
    expect(second.state.lastingEffects.map((e) => e.duration.kind)).toEqual([
      "nextVillainPhaseBegins",
      "nextVillainPhaseBegins",
    ]);
    const both = second.state.lastingEffects.map((e) => e.id);
    const round2 = run(second.session, endTurn);
    const ends = round2.events.flatMap((e, index) => (e.type === "lastingEffectEnded" ? [{ id: e.id, index }] : []));
    expect(ends.filter((e) => both.includes(e.id)).map((e) => e.id)).toEqual(both);
    // Consecutive: nothing happens between the two.
    const [first, last] = ends.filter((e) => both.includes(e.id));
    expect(last!.index - first!.index).toBe(1);
    expect(at(round2.events, "threatPlaced")).toBeGreaterThan(last!.index);
  });

  it("the duration is general: '+1 ATK until the next villain phase begins' lasts the player phase and is gone in the villain phase", () => {
    const base = start(MUTE);
    const hero = heroId(base);
    const given = giveCard(base, P1, VIGOR.card.id);
    const played = run(given.state, playFromHand(given.id));
    expect(characterProfile(played.state, hero, deps)?.atk).toBe(3);
    const ended = run(played.session, endTurn);
    expect(characterProfile(ended.state, hero, deps)?.atk).toBe(2);
    expect(ended.state.lastingEffects).toEqual([]);
  });

  it("with no such effect in play the player phase finishes exactly as before: no extra step is put on the stack", () => {
    const ended = run(start(MUTE), endTurn);
    expect(of(ended.events, "lastingEffectEnded")).toHaveLength(0);
    expect(of(ended.events, "lastingEffectAdded")).toHaveLength(0);
    expect(tallied(ended.state, "dawn")).toBe(1);
    expect(tallied(ended.state, "dusk")).toBe(1);
  });
});
