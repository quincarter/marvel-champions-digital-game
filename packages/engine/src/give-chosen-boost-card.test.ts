/**
 * docs/phase7-wave6.md §3.16: giving a chosen card as a boost card. Master of Magnetism (`mut_gen` 32151): "Take the
 * topmost [Magnetic] card in the encounter discard pile and give it to Magneto as a facedown boost card. Magneto
 * activates against you." `giveBoostCard.card` takes that card (from any out-of-play zone) facedown onto the enemy as
 * a boost card dealt outside its activation (RRG 1.8 "Boost, Boost Icon", p. 11): the activation that follows flips
 * it first (its boost icons, its Boost ability), then deals and flips its automatic one as normal, and each is
 * discarded to its own discard pile. A `noBoost` activation (§3.15) withholds only the automatic card. Synthetic
 * cards throughout.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const picked: TargetRef = { kind: "slot", slot: "picked" };

/** "Magnetic" encounter card: 2 boost icons. "Boost: Place 1 boosted counter on the villain." */
const MAG_BOOST = stubAbility(
  "mag.boost",
  def({
    trigger: { kind: "boost" },
    effects: [{ kind: "addCounters", target: theVillain, counterType: "boosted", amount: one }],
  }),
);
const MAG = stubTreachery({ id: "mag", boostIcons: 2, abilities: [MAG_BOOST.ref] });
const ONE = stubTreachery({ id: "one", boostIcons: 1 });

/** Master Mold's "Do not give [it] a boost card for this activation" (§3.15). */
const MOLD_SCHEMES = stubAbility(
  "mold.schemes",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", selfIs: "source" } },
    effects: [{ kind: "modifyAttack", noBoost: true }],
  }),
);

/** "Take [the card `from` names] and give it to the villain as a facedown boost card. The villain schemes against you." */
const giveAndScheme = (id: string, from: CardSelector | null, card: TargetRef = picked, scheme = true) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "action" },
      effects: [
        ...(from ? [{ kind: "selectCards", slot: "picked", cards: from } as EffectSpec] : []),
        { kind: "giveBoostCard", enemy: theVillain, card },
        ...(scheme ? [{ kind: "enemyScheme", enemies: theVillain, against: you } as EffectSpec] : []),
      ],
    }),
  );
const topmost = (of: CardSelector): CardSelector => ({ kind: "atMost", count: one, of });
const FROM_DISCARD = giveAndScheme(
  "discard.action",
  topmost({ kind: "encounter", zones: ["discard"], filter: { name: "mag" } }),
);
const FROM_DISCARD_ONLY = giveAndScheme(
  "discard-only.action",
  topmost({ kind: "encounter", zones: ["discard"], filter: { name: "mag" } }),
  picked,
  false,
);
const FROM_HAND = giveAndScheme(
  "hand.action",
  topmost({ kind: "zone", zone: "hand", player: you, filter: { name: "res" } }),
);
const FROM_SET_ASIDE = giveAndScheme(
  "set-aside.action",
  topmost({ kind: "encounterSetAside", filter: { name: "mag" } }),
);
const IN_PLAY = giveAndScheme("in-play.action", null, { kind: "self" });

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const DISCARD = support("discard", FROM_DISCARD);
const DISCARD_ONLY = support("discard-only", FROM_DISCARD_ONLY);
const HAND = support("hand", FROM_HAND);
const SET_ASIDE = support("set-aside", FROM_SET_ASIDE);
const SELF = support("in-play", IN_PLAY);

const deps: EngineDeps = depsOf(
  MAG_BOOST,
  MOLD_SCHEMES,
  FROM_DISCARD,
  FROM_DISCARD_ONLY,
  FROM_HAND,
  FROM_SET_ASIDE,
  IN_PLAY,
);

const villainOf = (mold: boolean) =>
  stubVillain({
    id: "villain",
    stages: [{ hp: flat(30), atk: 2, sch: 1, abilities: mold ? [MOLD_SCHEMES.ref] : [] }],
  });

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly cards: Readonly<Record<string, InstanceId>>;
  readonly villain: InstanceId;
  readonly scheme: InstanceId;
  /** The two MAG copies, in the order the game created them. */
  readonly mags: readonly InstanceId[];
}

type MagPlace = "discard" | "setAside" | "deck";

/**
 * Villain SCH 1, hero form, `inPlay` supports in play. The encounter deck is 16 ONEs; the two MAGs are in the
 * encounter discard pile (`mags[0]` on top), set aside, or left in the deck's bottom.
 */
function setup(inPlay: readonly (typeof DISCARD)[], place: MagPlace, mold = false): Setup {
  const state = newGame({
    villain: villainOf(mold),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [ONE, MAG, DISCARD, DISCARD_ONLY, HAND, SET_ASIDE, SELF],
    deck: [...inPlay.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: [...copies(ONE.id, 16), ...copies(MAG.id, 2)],
    deps,
  });
  const mags = Object.values(state.instances)
    .filter((i) => i.cardId === MAG.id)
    .map((i) => i.instanceId);
  const deck = Object.values(state.encounterDecks)[0]!.deck;
  const placed =
    place === "discard"
      ? withEncounterPiles(state, { deck: deck.filter((id) => !mags.includes(id)), discard: mags })
      : place === "setAside"
        ? {
            ...withEncounterPiles(state, { deck: deck.filter((id) => !mags.includes(id)) }),
            encounterSetAside: [...state.encounterSetAside, ...mags],
          }
        : withEncounterPiles(state, { deck: [...deck.filter((id) => !mags.includes(id)), ...mags] });
  const given = giveCards(placed, p1, ...inPlay.map((c) => c.id));
  const ids = given.ids as readonly InstanceId[];
  const ready = runWith(deps, given.state, { type: "changeForm", playerId: p1 }, ...ids.map(play));
  return {
    state: ready,
    cards: Object.fromEntries(inPlay.map((c, i) => [c.id, ids[i]!])),
    villain: Object.values(ready.instances).find((i) => i.cardId === "villain")!.instanceId,
    scheme: ready.mainScheme.instanceId,
    mags,
  };
}

function run(s: Setup, commands: readonly Command[]) {
  return driveSession(startSession(s.state), deps, commands, defaultPick);
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const piles = (state: GameState) => Object.values(state.encounterDecks)[0]!;

describe("giveBoostCard.card — Master of Magnetism's 'give it to Magneto as a facedown boost card'", () => {
  it("the topmost matching card leaves the encounter discard pile facedown onto the villain, outside an activation", () => {
    const s = setup([DISCARD_ONLY], "discard");
    const before = piles(s.state);
    const { session, events } = run(s, [use(s.cards["discard-only"]!, FROM_DISCARD_ONLY)]);
    const [top, second] = s.mags;
    expect(of(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: s.villain, instanceId: top, outsideActivation: true },
    ]);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([top]);
    expect(session.state.instances[top!]!.faceup).toBe(false);
    expect(piles(session.state).discard).toEqual([second]);
    expect(piles(session.state).deck).toEqual(before.deck);
    expect(of(events, "boostCardFlipped")).toEqual([]);
  });

  it("the activation that follows resolves it as a boost (icons, Boost ability), then the normal boost card", () => {
    const s = setup([DISCARD], "discard");
    const before = piles(s.state);
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards.discard!, FROM_DISCARD)]);
    const [mag, second] = s.mags;
    const automatic = before.deck[0]!;
    expect(of(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: s.villain, instanceId: mag, outsideActivation: true },
      { type: "boostCardDealt", enemyInstanceId: s.villain, instanceId: automatic },
    ]);
    expect(of(events, "boostCardFlipped")).toEqual([
      { type: "boostCardFlipped", enemyInstanceId: s.villain, instanceId: mag, boostIcons: 2 },
      { type: "boostCardFlipped", enemyInstanceId: s.villain, instanceId: automatic, boostIcons: 1 },
    ]);
    // SCH 1 + 2 (MAG) + 1 (the automatic card); MAG's Boost ability resolved once.
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 4);
    expect(session.state.instances[s.villain]!.counters).toEqual({ boosted: 1 });
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    // Each discarded after it is applied, in the order flipped: the automatic card ends on top.
    expect(piles(session.state).discard).toEqual([automatic, mag, second]);
    expect(piles(session.state).deck).toEqual(before.deck.slice(1));
  });

  it("a card from a player's hand: 0 boost icons, discarded to its owner's discard pile", () => {
    const s = setup([HAND], "deck");
    const hand = mustPlayer(s.state, p1).hand;
    const res = hand.find((id) => s.state.instances[id]!.cardId === RESOURCE.id)!;
    const discard = mustPlayer(s.state, p1).discard;
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards.hand!, FROM_HAND)]);
    expect(of(events, "boostCardFlipped")[0]).toEqual({
      type: "boostCardFlipped",
      enemyInstanceId: s.villain,
      instanceId: res,
      boostIcons: 0,
    });
    expect(of(events, "boostCardFlipped")).toHaveLength(2);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 2);
    expect(mustPlayer(session.state, p1).hand).toEqual(hand.filter((id) => id !== res));
    expect(mustPlayer(session.state, p1).discard).toEqual([res, ...discard]);
  });

  it("a set-aside encounter card: resolved, then discarded to the encounter discard pile", () => {
    const s = setup([SET_ASIDE], "setAside");
    const threat = s.state.instances[s.scheme]!.threat;
    const automatic = piles(s.state).deck[0]!;
    const { session, events } = run(s, [use(s.cards["set-aside"]!, FROM_SET_ASIDE)]);
    const [mag, second] = s.mags;
    expect(of(events, "boostCardFlipped").map((e) => [e.instanceId, e.boostIcons])).toEqual([
      [mag, 2],
      [automatic, 1],
    ]);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 4);
    expect(session.state.encounterSetAside).toEqual(s.state.encounterSetAside.filter((id) => id !== mag));
    expect(session.state.encounterSetAside).toContain(second);
    expect(piles(session.state).discard).toEqual([automatic, mag]);
  });

  it("with §3.15's noBoost: the given card still resolves; only the automatic boost card is withheld", () => {
    const s = setup([DISCARD], "discard", true);
    const before = piles(s.state);
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards.discard!, FROM_DISCARD)]);
    const [mag, second] = s.mags;
    expect(of(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: s.villain, instanceId: mag, outsideActivation: true },
    ]);
    expect(of(events, "boostWithheld")).toEqual([
      { type: "boostWithheld", enemyInstanceId: s.villain, activation: "scheme" },
    ]);
    expect(of(events, "boostCardFlipped")).toEqual([
      { type: "boostCardFlipped", enemyInstanceId: s.villain, instanceId: mag, boostIcons: 2 },
    ]);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 3);
    expect(session.state.instances[s.villain]!.counters).toEqual({ boosted: 1 });
    expect(piles(session.state).deck).toEqual(before.deck);
    expect(piles(session.state).discard).toEqual([mag, second]);
  });

  it("no card found: nothing is given, and the activation gets its normal boost card alone", () => {
    const s = setup([DISCARD], "deck");
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards.discard!, FROM_DISCARD)]);
    expect(of(events, "boostCardDealt")).toHaveLength(1);
    expect(of(events, "boostCardDealt")[0]!.outsideActivation).toBeUndefined();
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 2);
  });

  it("a card in play is not given", () => {
    const s = setup([SELF], "deck");
    const { session, events } = run(s, [use(s.cards["in-play"]!, IN_PLAY)]);
    // The ability resolved (its scheme got the automatic card), but the support stayed in play.
    expect(of(events, "boostCardDealt")).toHaveLength(1);
    expect(of(events, "boostCardDealt").filter((e) => e.outsideActivation)).toEqual([]);
    expect(mustPlayer(session.state, p1).playArea).toContain(s.cards["in-play"]);
  });

  it("replays deep-equal", () => {
    const s = setup([DISCARD_ONLY, DISCARD, HAND], "discard", true);
    const { session } = run(s, [
      use(s.cards["discard-only"]!, FROM_DISCARD_ONLY),
      use(s.cards.discard!, FROM_DISCARD),
      use(s.cards.hand!, FROM_HAND),
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
