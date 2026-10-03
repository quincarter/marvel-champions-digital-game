/**
 * docs/phase7-wave6.md §3.50: "You gain each of the attached character's TRAITS until the end of the round." (Skin
 * Contact, `rogue` 38001a; Energy Transfer, 38007; both erratum RRG 1.8 p. 69), as `grantTraitUntil.traitsOf` with
 * `whileAttached`, proven with a synthetic "charm" upgrade shaped like Touched (38002).
 *
 * Owner decision §4.1 Q28 (differs from the default): "Rogue's copied traits are live, for as long as Touched stays on
 * that character." Built as: the host is fixed when the effect resolves; every read gives the host's traits **now**,
 * printed and granted; the grant ends at the end of the round (the printed duration) or as soon as the charm is no
 * longer attached to that host (moved, set aside, or discarded with its host), whichever comes first. A later
 * attachment to the same host does not revive it.
 *
 * Sources: RRG 1.8 "Lasting Effects" (p. 26: "Lasting effects update whenever the game state updates"; an "until the
 * end of the round" effect "expires as soon as the timing point specified by its duration is reached"), "Gains" (p. 21:
 * gained characteristics "are not considered to be printed on the card"), "Traits" (p. 45: traits are not part of the
 * text box, so copying them copies no ability), "Attach To" (p. 8).
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, trait, type CardId, type Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { applyCommand, replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { keywordsOf } from "./keywords.js";
import type { LastingEffect } from "./lasting.js";
import { mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, traitsOf } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, seatIdentities, settle } from "./testing/scenario.js";
import { minionEngagedWith, playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };

const X_MEN = trait("X-MEN");
const SPY = trait("SPY");
const HEROIC = trait("HEROIC");
const BRUTE = trait("BRUTE");
const CRIMINAL = trait("CRIMINAL");
const MASTERMIND = trait("MASTERMIND");

/** A minion ability Rogue must not pick up (copying traits copies no text: RRG 1.8 "Traits", p. 45). */
const GOON_TEXT = stubAbility("goon.text", { trigger: { kind: "constant" }, effects: [] });
const CHARM = stubUpgrade({ id: "charm", cost: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const GOON = stubMinion({
  id: "goon",
  atk: 0,
  sch: 0,
  hp: 5,
  traits: [BRUTE],
  keywords: [{ name: "guard" }],
  abilities: [GOON_TEXT.ref],
});
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3, traits: [SPY] });
const MATE = stubAlly({ id: "mate", cost: 0, atk: 1, thw: 1, hp: 3, traits: [X_MEN, HEROIC] });
const TWO_STAGE = stubVillain({
  id: "twostage",
  stages: [
    { hp: flat(5), atk: 0, sch: 0, traits: [CRIMINAL] },
    { hp: flat(30), atk: 0, sch: 0, traits: [MASTERMIND] },
  ],
});
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const CHARM_QUERY: TargetQuery = { categories: ["upgrade"], name: "charm" };
const THE_CHARM: TargetRef = { kind: "each", query: CHARM_QUERY };
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });

const actionEvent = (id: string, effects: readonly EffectSpec[], cost?: AbilityCost) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "You gain each of `host`'s traits until the end of the round", optionally for as long as the charm stays on it. */
const copyOf = (host: TargetRef, bound: boolean): EffectSpec => ({
  kind: "grantTraitUntil",
  traitsOf: host,
  target: yourIdentity,
  until: "endOfRound",
  ...(bound ? { whileAttached: { card: { kind: "slot", slot: "touched" }, to: host } } : {}),
});
/** Skin Contact's shape: "Find [the charm] and attach it to `host`. You gain each of the attached character's TRAITS …". */
const skin = (id: string, host: TargetRef) =>
  actionEvent(id, [
    { kind: "findCard", query: CHARM_QUERY, owner: you, to: { attachTo: host }, bind: "touched" },
    copyOf(host, true),
  ]);
const SKIN_PAL = skin("skin-pal", named("pal"));
const SKIN_GOON = skin("skin-goon", named("goon"));
const SKIN_VILLAIN = skin("skin-villain", { kind: "villain" });
const SKIN_MATE = skin("skin-mate", named("mate"));
/** Energy Transfer's shape: the attach is the cost and binds the host; the effect copies the bound host. */
const TRANSFER = actionEvent("transfer", [copyOf({ kind: "slot", slot: "host" }, true)], {
  attach: {
    card: { kind: "find", query: CHARM_QUERY, owner: you },
    to: { slot: "host", query: { categories: ["character"], excluding: yourIdentity } },
    bind: "touched",
  },
});
/** The Q28 default, for contrast: copies, not bound to the charm (each use its own lasting effect). */
const COPY_PAL = actionEvent("copy-pal", [copyOf(named("pal"), false)]);
const COPY_VILLAIN = actionEvent("copy-villain", [copyOf({ kind: "villain" }, false)]);
/** "Bound" to a charm that is not on the named host: nothing is granted. */
const MISBOUND = actionEvent("misbound", [
  { kind: "bindTargets", slot: "touched", target: THE_CHARM },
  copyOf(named("goon"), true),
]);
/** The pal copies "you" back: two characters copying each other. */
const PAL_COPIES_YOU = actionEvent("pal-copies-you", [
  { kind: "grantTraitUntil", traitsOf: yourIdentity, target: named("pal"), until: "endOfRound" },
]);
/** Drivers. */
const MOVE_TO_GOON = actionEvent("move-to-goon", [{ kind: "attach", card: THE_CHARM, to: named("goon") }]);
const MOVE_TO_PAL = actionEvent("move-to-pal", [{ kind: "attach", card: THE_CHARM, to: named("pal") }]);
const SET_ASIDE = actionEvent("set-aside", [{ kind: "findCard", query: CHARM_QUERY, owner: you, to: "setAside" }]);
const PAL_HEROIC = actionEvent("pal-heroic", [
  { kind: "grantTraitUntil", trait: HEROIC, target: named("pal"), until: "endOfPhase" },
]);
const SMASH_VILLAIN = actionEvent("smash-villain", [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 5 } },
]);
const KILL_PAL = actionEvent("kill-pal", [
  { kind: "dealDamage", target: named("pal"), amount: { kind: "const", value: 3 } },
]);
/** A trait-reading card: "If you have the SPY trait, place 1 'spy' counter on your identity." */
const IF_SPY = actionEvent("if-spy", [
  {
    kind: "if",
    condition: { kind: "hasTrait", of: yourIdentity, trait: SPY },
    then: [{ kind: "addCounters", target: yourIdentity, counterType: "spy", amount: { kind: "const", value: 1 } }],
  },
]);

const EVENTS = [
  SKIN_PAL,
  SKIN_GOON,
  SKIN_VILLAIN,
  SKIN_MATE,
  TRANSFER,
  COPY_PAL,
  COPY_VILLAIN,
  MISBOUND,
  MOVE_TO_GOON,
  MOVE_TO_PAL,
  SET_ASIDE,
  PAL_HEROIC,
  SMASH_VILLAIN,
  KILL_PAL,
  IF_SPY,
  PAL_COPIES_YOU,
];
const deps: EngineDeps = depsOf(GOON_TEXT, ...EVENTS.map((e) => e.ability));
const EVENT_IDS = EVENTS.map((e) => e.card.id as CardId);

function game(seed = 11): GameState {
  const identities = seatIdentities(
    stubIdentity({
      id: "absorber",
      hp: 10,
      atk: 2,
      thw: 2,
      def: 2,
      rec: 3,
      heroHandSize: 5,
      alterEgoHandSize: 6,
      heroTraits: [X_MEN],
    }),
    2,
  );
  const config: GameSetupConfig = {
    seed,
    cards: [
      ...DEFAULT_CARDS,
      TWO_STAGE,
      LONG_SCHEME,
      BLANK,
      GOON,
      PAL,
      MATE,
      CHARM,
      ...EVENTS.map((e) => e.card),
      ...identities,
    ],
    villainCardId: TWO_STAGE.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), GOON.id, GOON.id],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENT_IDS, PAL.id, MATE.id, CHARM.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

/** p1 in hero form, a minion engaged with p1, p2's ally in play. */
function board(seed?: number) {
  const start = game(seed);
  const flipped = runCommands(start, deps, { type: "changeForm", playerId: p1 }).state;
  const withGoon = minionEngagedWith(flipped, GOON.id, p1);
  const withPal = playerCardIntoPlay(withGoon.state, PAL.id, p2);
  return { state: withPal.state, goon: withGoon.id, pal: withPal.id };
}

const charmOf = (state: GameState): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find(
    (id) => state.instances[id]?.cardId === CHARM.id && state.instances[id]?.ownerId === p1,
  )!;
const identityId = (state: GameState, player: PlayerId = p1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
/** p1's identity's traits, sorted (order is not a rule). */
const rogueTraits = (state: GameState): readonly Trait[] => [...traitsOf(state, identityId(state), deps)].sort();
const sorted = (...traits: readonly Trait[]) => [...traits].sort();

function play(state: GameState, card: { readonly id: CardId }, costChoices?: Record<string, readonly InstanceId[]>) {
  const given = giveCard(state, p1, card.id);
  const result = applyCommand(
    given.state,
    {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
      ...(costChoices ? { costChoices } : {}),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  expect(result.state.pendingChoice).toBeNull();
  return { state: result.state, events: result.events };
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const copies = (state: GameState): readonly LastingEffect[] =>
  state.lastingEffects.filter((e) => e.kind === "traitGrant" && e.copiedFrom !== undefined);

describe("§3.50 gaining another character's traits: what is gained", () => {
  it("exactly the host's traits, added to Rogue's own, recorded as a lasting effect bound to the charm", () => {
    const { state: start, pal } = board();
    expect(rogueTraits(start)).toEqual([X_MEN]);
    const { state, events } = play(start, SKIN_PAL.card);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, SPY));
    expect(copies(state)).toEqual([
      {
        kind: "traitGrant",
        copiedFrom: [pal],
        targets: [identityId(state)],
        affects: null,
        scope: expect.anything(),
        id: expect.any(String),
        duration: { kind: "endOfRound" },
        whileAttached: { card: charmOf(state), host: pal },
      },
    ]);
    expect(typed(events, "lastingEffectAdded")).toHaveLength(1);
    // Only Rogue gains them; the host and everyone else are unchanged.
    expect(traitsOf(state, pal, deps)).toEqual([SPY]);
    expect(traitsOf(state, identityId(state, p2), deps)).toEqual([]);
  });

  it("near miss: the host's keywords and text are not copied, only its traits", () => {
    const { state: start, goon } = board();
    const { state } = play(start, SKIN_GOON.card);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, BRUTE));
    expect(keywordsOf(state, goon, deps).map((k) => k.name)).toContain("guard");
    expect(keywordsOf(state, identityId(state), deps).map((k) => k.name)).not.toContain("guard");
    expect(activeAbilityRefs(state, goon, deps).map((r) => r.id)).toContain(GOON_TEXT.ref.id);
    expect(activeAbilityRefs(state, identityId(state), deps).map((r) => r.id)).not.toContain(GOON_TEXT.ref.id);
  });

  it("a trait Rogue already has is had once (a host sharing X-MEN)", () => {
    const { state: start } = board();
    const withMate = playerCardIntoPlay(start, MATE.id, p2);
    const { state } = play(withMate.state, SKIN_MATE.card);
    expect(traitsOf(state, identityId(state), deps)).toEqual([X_MEN, HEROIC]);
    expect(copies(state)).toHaveLength(1);
  });

  it("the villain is a host: its current stage's traits", () => {
    const { state: start } = board();
    const { state } = play(start, SKIN_VILLAIN.card);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, CRIMINAL));
  });

  it("Energy Transfer's shape: the cost's host is copied, and the grant is bound to the charm on it", () => {
    const { state: start, goon } = board();
    const { state } = play(start, TRANSFER.card, { host: [goon] });
    expect(mustInstance(state, charmOf(state)).attachedTo).toBe(goon);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, BRUTE));
    expect(copies(state)[0]?.whileAttached).toEqual({ card: charmOf(state), host: goon });
  });

  it("a trait-reading card sees the copied trait (hasTrait), and does not before or after it", () => {
    const { state: start } = board();
    const before = play(start, IF_SPY.card).state;
    expect(mustInstance(before, identityId(before)).counters.spy).toBeUndefined();
    const copied = play(start, SKIN_PAL.card).state;
    const read = play(copied, IF_SPY.card).state;
    expect(mustInstance(read, identityId(read)).counters.spy).toBe(1);
    const moved = play(copied, MOVE_TO_GOON.card).state;
    const after = play(moved, IF_SPY.card).state;
    expect(mustInstance(after, identityId(after)).counters.spy).toBeUndefined();
  });
});

describe("§3.50 / Q28: the copy is live while the charm stays on that host", () => {
  it("follows the host's trait changes: a trait the host gains is gained, and lost with it at the end of the phase", () => {
    const { state: start } = board();
    const copied = play(start, SKIN_PAL.card).state;
    const heroic = play(copied, PAL_HEROIC.card).state;
    expect(rogueTraits(heroic)).toEqual(sorted(X_MEN, SPY, HEROIC));
    // Through the rest of the round: p1 and p2 end their turns, the villain phase runs, the round ends.
    const { events, state: nextRound } = runCommands(
      heroic,
      deps,
      { type: "endTurn", playerId: p1 },
      { type: "endTurn", playerId: p2 },
    );
    expect(nextRound.round).toBe(2);
    const [copy, palGrant] = heroic.lastingEffects.filter((e) => e.kind === "traitGrant");
    expect(copy?.copiedFrom).toBeDefined();
    const ended = typed(events, "lastingEffectEnded");
    const palEnd = events.indexOf(ended.find((e) => e.id === palGrant!.id)!);
    const copyEnd = events.indexOf(ended.find((e) => e.id === copy!.id)!);
    const round2 = events.findIndex((e) => e.type === "roundStarted" && e.round === 2);
    // The host's HEROIC ends with the player phase; the copy lasts through the villain phase and ends with the round.
    expect(ended.find((e) => e.id === copy!.id)?.reason).toBe("expired");
    expect(palEnd).toBeGreaterThan(-1);
    expect(copyEnd).toBeGreaterThan(palEnd);
    expect(copyEnd).toBeLessThan(round2);
    expect(rogueTraits(nextRound)).toEqual([X_MEN]);
  });

  it("follows the villain to its next stage: the new stage's traits replace the old", () => {
    const { state: start } = board();
    const copied = play(start, SKIN_VILLAIN.card).state;
    const advanced = play(copied, SMASH_VILLAIN.card).state;
    expect(mustInstance(advanced, villainId(advanced)).attachments).toEqual([charmOf(advanced)]);
    expect(rogueTraits(advanced)).toEqual(sorted(X_MEN, MASTERMIND));
  });

  it("near miss, the Q28 default would keep them: moving the charm to another host ends the copy at once", () => {
    const { state: start, pal } = board();
    const copied = play(start, SKIN_PAL.card).state;
    const copy = copies(copied)[0]!;
    const { state, events } = play(copied, MOVE_TO_GOON.card);
    expect(mustInstance(state, charmOf(state)).attachedTo).not.toBe(pal);
    expect(rogueTraits(state)).toEqual([X_MEN]);
    expect(copies(state)).toEqual([]);
    expect(typed(events, "lastingEffectEnded")).toEqual([
      { type: "lastingEffectEnded", id: copy.id, reason: "detached" },
    ]);
    // Moving it back the same round does not revive it (it ended; it is not merely paused).
    const back = play(state, MOVE_TO_PAL.card).state;
    expect(rogueTraits(back)).toEqual([X_MEN]);
  });

  it("setting the charm aside ends it (Withdrawn / the player phase's Forced Response shape)", () => {
    const { state: start } = board();
    const copied = play(start, SKIN_PAL.card).state;
    const { state, events } = play(copied, SET_ASIDE.card);
    expect(mustPlayer(state, p1).setAside).toEqual([charmOf(state)]);
    expect(rogueTraits(state)).toEqual([X_MEN]);
    expect(typed(events, "lastingEffectEnded").map((e) => e.reason)).toEqual(["detached"]);
  });

  it("the host leaving play takes the charm with it and ends the copy", () => {
    const { state: start, pal } = board();
    const copied = play(start, SKIN_PAL.card).state;
    const { state, events } = play(copied, KILL_PAL.card);
    expect(mustPlayer(state, p2).discard).toContain(pal);
    expect(rogueTraits(state)).toEqual([X_MEN]);
    const moved = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === charmOf(state));
    const ended = events.findIndex((e) => e.type === "lastingEffectEnded");
    expect(moved).toBeGreaterThan(-1);
    expect(ended).toBeGreaterThan(moved);
  });

  it("a new host replaces the old: Skin Contact on the pal, then again on the minion", () => {
    const { state: start } = board();
    const onPal = play(start, SKIN_PAL.card).state;
    const { state, events } = play(onPal, SKIN_GOON.card);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, BRUTE));
    expect(copies(state)).toHaveLength(1);
    expect(typed(events, "lastingEffectEnded").map((e) => e.reason)).toEqual(["detached"]);
  });

  it("nothing is granted when the bound charm is not on the host as the effect resolves", () => {
    const { state: start } = board();
    const onPal = play(start, SKIN_PAL.card).state;
    const { state, events } = play(onPal, MISBOUND.card);
    expect(typed(events, "lastingEffectAdded")).toEqual([]);
    expect(rogueTraits(state)).toEqual(sorted(X_MEN, SPY));
  });
});

describe("§3.50: copies of copies", () => {
  it("two characters copying each other each get the other's printed traits, and the read terminates", () => {
    const { state: start, pal } = board();
    const one = play(start, SKIN_PAL.card).state;
    const both = play(one, PAL_COPIES_YOU.card).state;
    expect(rogueTraits(both)).toEqual(sorted(X_MEN, SPY));
    expect([...traitsOf(both, pal, deps)].sort()).toEqual(sorted(X_MEN, SPY));
    // A trait the pal gains from elsewhere still reaches Rogue through the copy.
    const heroic = play(both, PAL_HEROIC.card).state;
    expect(rogueTraits(heroic)).toEqual(sorted(X_MEN, SPY, HEROIC));
  });
});

describe("§3.50: unbound copies (the primitive without whileAttached) stack", () => {
  it("two copies from two hosts add up, and survive the charm moving", () => {
    const { state: start } = board();
    const one = play(start, COPY_PAL.card).state;
    const two = play(one, COPY_VILLAIN.card).state;
    expect(rogueTraits(two)).toEqual(sorted(X_MEN, SPY, CRIMINAL));
    expect(copies(two)).toHaveLength(2);
    expect(copies(two).every((e) => e.whileAttached === undefined)).toBe(true);
    const moved = play(two, SKIN_GOON.card).state;
    expect(rogueTraits(moved)).toEqual(sorted(X_MEN, SPY, CRIMINAL, BRUTE));
  });

  it("an unbound copy of a host that left play gives nothing", () => {
    const { state: start } = board();
    const copied = play(start, COPY_PAL.card).state;
    const gone = play(copied, KILL_PAL.card).state;
    expect(copies(gone)).toHaveLength(1);
    expect(rogueTraits(gone)).toEqual([X_MEN]);
  });
});

describe("§3.50: nothing changes for a game without it; replay", () => {
  it("a one-trait grant keeps its exact shape (no copiedFrom, no whileAttached)", () => {
    const { state: start, pal } = board();
    const { state } = play(start, PAL_HEROIC.card);
    const [grant] = state.lastingEffects;
    expect(Object.keys(grant!).sort()).toEqual(["affects", "duration", "id", "kind", "scope", "targets", "trait"]);
    expect(grant).toMatchObject({ kind: "traitGrant", trait: HEROIC, targets: [pal] });
  });

  it("a full round with no copy logs no detached end and leaves Rogue's traits printed", () => {
    const { state: start } = board();
    const { events, state } = runCommands(
      start,
      deps,
      { type: "endTurn", playerId: p1 },
      { type: "endTurn", playerId: p2 },
    );
    expect(state.round).toBe(2);
    expect(typed(events, "lastingEffectEnded").filter((e) => e.reason === "detached")).toEqual([]);
    expect(rogueTraits(settle(state, undefined, deps))).toEqual([X_MEN]);
  });

  it("copy, live change, move and round end replay deep-equal", () => {
    const { state: start } = board(7);
    // `giveCard` is test surgery, so the session starts after it: hand p1 every card first.
    let state = start;
    const ids: InstanceId[] = [];
    for (const card of [SKIN_PAL.card, PAL_HEROIC.card, MOVE_TO_GOON.card, SKIN_VILLAIN.card]) {
      const given = giveCard(state, p1, card.id);
      state = given.state;
      ids.push(given.id);
    }
    let session = startSession(state);
    for (const command of [
      ...ids.map((id) => ({
        type: "playCard" as const,
        playerId: p1,
        cardInstanceId: id,
        payment: [],
        attachToInstanceId: null,
      })),
      { type: "endTurn" as const, playerId: p1 },
    ]) {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    expect(rogueTraits(session.state)).toEqual(sorted(X_MEN, CRIMINAL));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
