/**
 * `preview()` — what a command would do, and where it refuses to guess.
 *
 * Every test is tied to the RRG 1.8 page it is checking; page numbers are the printed ones in
 * `mc_rulesreference_v18_compressed.pdf` (they match the PDF's own page indexes).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { preview } from "./preview.js";
import { activeVillain, mustPlayer } from "./query.js";

import { shuffle } from "./rng.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, newGame, RESOURCE, run, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(40), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(60), acceleration: flat(0) }],
});
const deckOf = (id: CardId, count = 20): readonly CardId[] => Array.from({ length: count }, () => id);

const heroOf = (state: GameState): InstanceId => mustPlayer(state, p1).identity.instanceId;
const attack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p1,
  attackerInstanceId: heroOf(state),
  targetInstanceId: target,
});
const patch = (state: GameState, id: InstanceId, changes: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...changes } },
});
const types = (events: readonly GameEvent[]): readonly string[] => events.map((event) => event.type);

/** A hero-form game with one minion of `card` engaged with p1, from an encounter deck of nothing else. */
function withMinion(
  card: ReturnType<typeof stubMinion>,
  extra: { readonly deps?: EngineDeps; readonly cards?: readonly AnyCard[]; readonly deck?: readonly CardId[] } = {},
): { state: GameState; minion: InstanceId } {
  const deps = extra.deps;
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [card, ...(extra.cards ?? [])],
    encounterDeck: deckOf(card.id),
    ...(extra.deck ? { deck: extra.deck } : {}),
    ...(deps ? { deps } : {}),
  });
  const roundTwo = deps
    ? runWith(deps, settle(runWith(deps, start, endTurn), defaultPick, deps), toHero)
    : run(settle(run(start, endTurn)), toHero);
  const [minion] = mustPlayer(roundTwo, p1).playArea;
  if (!minion) throw new Error("no minion engaged");
  return { state: roundTwo, minion };
}

/** Test surgery: puts hand cards back on top of the deck until the hand is at `size`, so no end-of-phase discard is asked for. */
const trimHand = (state: GameState, size: number): GameState => ({
  ...state,
  players: state.players.map((player) =>
    player.playerId === p1
      ? { ...player, hand: player.hand.slice(0, size), deck: [...player.hand.slice(size), ...player.deck] }
      : player,
  ),
});

// ---------------------------------------------------------------------------
// A preview is a query, never a command.
// ---------------------------------------------------------------------------

test("previewing changes nothing about the state it was given, the RNG included", () => {
  const state = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero);
  const before = structuredClone(state);

  preview(state, attack(state, activeVillain(state).instanceId));
  preview(state, endTurn);
  preview(state, { type: "basicRecover", playerId: p1 });

  expect(state).toEqual(before);
});

test("a session that previews before every command logs exactly what one that doesn't logs", () => {
  const start = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero);
  const commands: readonly Command[] = [attack(start, activeVillain(start).instanceId), endTurn];

  const plain = commands.reduce((session, command) => {
    const result = sessionApply(session, command);
    if (!result.ok) throw new Error(result.error.message);
    return result.session;
  }, startSession(start));

  const previewed = commands.reduce((session, command) => {
    preview(session.state, command);
    preview(session.state, endTurn);
    const result = sessionApply(session, command);
    if (!result.ok) throw new Error(result.error.message);
    preview(result.session.state, endTurn);
    return result.session;
  }, startSession(start));

  expect(previewed.log).toEqual(plain.log);
  expect(previewed.state).toEqual(plain.state);
});

// ---------------------------------------------------------------------------
// The preview and the engine cannot diverge: it *is* the engine.
// ---------------------------------------------------------------------------

test("a preview's events are a prefix of the events the command actually produces", () => {
  const state = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero);
  for (const command of [
    attack(state, activeVillain(state).instanceId),
    endTurn,
    {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: heroOf(state),
      schemeInstanceId: state.mainScheme.instanceId,
    } as Command,
  ]) {
    const previewed = preview(state, command);
    const real = applyCommand(state, command);
    if (!real.ok) {
      expect(previewed.stop).toEqual({ kind: "rejected", reason: real.error.code, message: real.error.message });
      continue;
    }
    expect(previewed.events).toEqual(real.events.slice(0, previewed.events.length));
  }
});

// ---------------------------------------------------------------------------
// Rejection carries the engine's own reason. RRG 1.8 "Guard" (p. 21).
// ---------------------------------------------------------------------------

test("a guard minion makes an attack on the villain a rejected preview, carrying the engine's own code", () => {
  const guard = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 4, boostIcons: 0, keywords: [{ name: "guard" }] });
  const { state, minion } = withMinion(guard);
  const villain = activeVillain(state).instanceId;

  const blocked = preview(state, attack(state, villain));
  expect(blocked.stop.kind).toBe("rejected");
  if (blocked.stop.kind !== "rejected") throw new Error("expected a rejection");
  expect(blocked.stop.reason).toBe("no_valid_target");
  expect(blocked.stop.message).toMatch(/guard/);
  expect(blocked.events).toEqual([]);
  expect(blocked.counters).toEqual([]);

  // The same attack is fine once the guard minion is gone (p. 21: it is the engaged minion that restricts).
  const cleared = patch(
    { ...state, players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== minion) })) },
    minion,
    { engagedWith: null },
  );
  expect(preview(cleared, attack(cleared, villain)).stop.kind).not.toBe("rejected");
});

// ---------------------------------------------------------------------------
// Counters and the events that explain them.
// ---------------------------------------------------------------------------

test("a lethal attack on a minion previews the defeat, and reports no overkill spill without the keyword", () => {
  // RRG 1.8 "Overkill" (p. 31): excess damage carries over only with the keyword; otherwise it is simply lost.
  const weak = stubMinion({ id: "weak", atk: 1, sch: 0, hp: 1, boostIcons: 0 });
  const { state, minion } = withMinion(weak);

  const result = preview(state, attack(state, minion));
  expect(types(result.events)).toContain("characterDefeated");
  expect(types(result.events)).not.toContain("overkillSpilled");

  const counter = result.counters.find((entry) => entry.instanceId === minion);
  expect(counter?.before.remainingHitPoints).toBe(1);
  expect(counter?.before.inPlay).toBe(true);
  expect(counter?.after.inPlay).toBe(false);

  // The hero takes nothing: the excess was lost, not carried (p. 31).
  const hero = result.counters.find((entry) => entry.instanceId === heroOf(state));
  expect(hero?.after.damage ?? 0).toBe(0);
});

test("an attack with overkill previews the spill, and the identity's counters move with it", () => {
  const weak = stubMinion({ id: "weak", atk: 1, sch: 0, hp: 1, boostIcons: 0 });
  const smash = stubAbility("smash", {
    trigger: { kind: "action", form: "hero" },
    label: ["attack"],
    effects: [
      {
        kind: "attack",
        target: { kind: "each", query: { categories: ["minion"] } },
        amount: { kind: "const", value: 4 },
        overkill: true,
      },
    ],
  });
  const SMASH = stubEvent({ id: "smash", cost: 0, abilities: [smash.ref] });
  const deps = depsOf(smash);
  const { state, minion } = withMinion(weak, {
    deps,
    cards: [SMASH],
    deck: [...deckOf(RESOURCE.id, 14), ...deckOf(SMASH.id, 6)],
  });
  const given = giveCard(state, p1, SMASH.id);

  const result = preview(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  const spill = result.events.find((event) => event.type === "overkillSpilled");
  expect(spill).toBeDefined();
  expect(spill?.type === "overkillSpilled" && spill.amount).toBe(3);
  expect(result.counters.find((entry) => entry.instanceId === minion)?.after.inPlay).toBe(false);
  // The spill goes on to the villain (p. 31: excess damage from a defeated minion carries to the villain).
  const villain = result.counters.find((entry) => entry.instanceId === activeVillain(given.state).instanceId);
  expect(villain?.before.damage).toBe(0);
  expect(villain?.after.damage).toBe(3);
  expect(villain?.after.remainingHitPoints).toBe((villain?.before.remainingHitPoints ?? 0) - 3);
});

test("a tough status previews as damage prevented, with the hit points unchanged", () => {
  // RRG 1.8 "Tough" (p. 44): the damage is prevented entirely and the status card is discarded.
  const weak = stubMinion({ id: "weak", atk: 1, sch: 0, hp: 5, boostIcons: 0 });
  const { state, minion } = withMinion(weak);
  const tough = patch(state, minion, { statuses: { stunned: 0, confused: 0, tough: 1 } });

  const result = preview(tough, attack(tough, minion));
  const prevented = result.events.find((event) => event.type === "damagePrevented");
  expect(prevented?.type === "damagePrevented" && prevented.reason).toBe("tough");
  expect(types(result.events)).not.toContain("damageDealt");

  const counter = result.counters.find((entry) => entry.instanceId === minion);
  expect(counter?.before.remainingHitPoints).toBe(5);
  expect(counter?.after.remainingHitPoints).toBe(5);
  expect(counter?.before.statuses.tough).toBe(1);
  expect(counter?.after.statuses.tough).toBe(0);
});

// ---------------------------------------------------------------------------
// Stops. RRG 1.8 "Ability" (p. 5), "Attack (Enemy Activation)" step 6 (p. 9).
// ---------------------------------------------------------------------------

const RESPONSE_EFFECT = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value: 1 },
} as const;

function responseGame(forced: boolean): { state: GameState; deps: EngineDeps; support: InstanceId } {
  const ability = stubAbility(`respond-${String(forced)}`, {
    trigger: { kind: "response", forced, on: { on: "characterAttacked" } },
    effects: [RESPONSE_EFFECT],
  });
  const SUPPORT = stubSupport({ id: "support", cost: 0, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [SUPPORT],
    deck: [...deckOf(RESOURCE.id, 10), ...deckOf(SUPPORT.id, 6), ...deckOf(ALLY.id, 4)],
    deps,
  });
  const given = giveCard(start, p1, SUPPORT.id);
  const state = runWith(deps, given.state, toHero, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { state, deps, support: given.id };
}

test("an optional response window stops the preview: what another card does is not the engine's to predict", () => {
  const { state, deps } = responseGame(false);
  const result = preview(state, attack(state, activeVillain(state).instanceId), deps);
  expect(result.stop.kind).toBe("choice");
  if (result.stop.kind !== "choice") throw new Error("expected a parked choice");
  expect(result.stop.prompt.kind).toBe("chooseTriggers");
  expect(result.stop.playerId).toBe(p1);
  // Everything up to the window is still certain: the attack's own damage is in the preview.
  expect(types(result.events)).toContain("damageDealt");
});

test("a forced response resolves inside the preview, because it is mandatory and public", () => {
  const { state, deps } = responseGame(true);
  const result = preview(state, attack(state, activeVillain(state).instanceId), deps);
  expect(result.stop.kind).toBe("complete");
  // Two damage events: the attack's, and the forced response's.
  expect(types(result.events).filter((type) => type === "damageDealt").length).toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// Hidden information. RRG 1.8 "Deck" (p. 15), "Encounter Deck" (p. 17),
// "Look, Looked-At" (p. 27), "Boost" (p. 11).
// ---------------------------------------------------------------------------

const deckCards = (state: GameState): ReadonlySet<string> =>
  new Set([...mustPlayer(state, p1).deck, ...Object.values(state.encounterDecks).flatMap((piles) => piles.deck)]);

test("previewing the end of the turn stops before anything comes out of a closed deck", () => {
  // An empty hand, so the preview runs past the end-of-phase discard (which is offered whenever a hand has cards in
  // it, whether or not it is over the limit) and into the draw, which is where the deck starts to matter.
  const state = trimHand(run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero), 0);
  const result = preview(state, endTurn);

  expect(result.stop.kind).toBe("hiddenInformation");
  const real = applyCommand(state, endTurn);
  expect(real.ok && result.events.length).toBeLessThan(real.ok ? real.events.length : 0);

  // Nothing the player may not look at is named anywhere in what was reported.
  const closed = deckCards(state);
  const mentioned = JSON.stringify(result.events);
  for (const id of closed) expect(mentioned).not.toContain(`"${id}"`);
  // And no outcome is claimed from behind the cut.
  expect(result.outcome).toBeNull();
});

test("shuffling every hidden zone changes nothing about any preview", () => {
  const state = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero);
  const commands: readonly Command[] = [
    endTurn,
    attack(state, activeVillain(state).instanceId),
    { type: "basicRecover", playerId: p1 },
  ];

  // A different order for every closed deck, and nothing else: the same cards, in another sequence.
  let rng = { value: 99, draws: 0 };
  const reorder = <T>(items: readonly T[]): readonly T[] => {
    const [out, next] = shuffle(items, rng);
    rng = next;
    return out;
  };
  const permuted: GameState = {
    ...state,
    players: state.players.map((player) => ({ ...player, deck: reorder(player.deck) })),
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([id, piles]) => [id, { ...piles, deck: reorder(piles.deck) }]),
    ),
  };
  expect(permuted.players[0]?.deck).not.toEqual(state.players[0]?.deck);

  for (const command of commands) expect(preview(permuted, command)).toEqual(preview(state, command));
});

/**
 * A 1-HP minion in play with one facedown card tucked under it (RRG 1.8 "Tuck", p. 45: tucked cards are facedown and
 * out of play, and are discarded when their host leaves play — which turns them faceup).
 */
function withTuckedCard(): { state: GameState; minion: InstanceId; tucked: InstanceId } {
  const weak = stubMinion({ id: "weak", atk: 1, sch: 0, hp: 1, boostIcons: 0 });
  const { state, minion } = withMinion(weak);
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId as string];
  if (!deckId || !piles) throw new Error("no encounter deck");
  const [tucked, ...rest] = piles.deck;
  if (!tucked) throw new Error("empty encounter deck");
  const tuckedIn: GameState = {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: rest } },
    instances: {
      ...state.instances,
      [tucked]: { ...(state.instances[tucked] as CardInstance), faceup: false },
      [minion]: { ...(state.instances[minion] as CardInstance), tucked: [tucked] },
    },
  };
  return { state: tuckedIn, minion, tucked };
}

test("a facedown card sitting on the table does not blank an unrelated preview", () => {
  // Being near a facedown card is not reading it: nothing in this attack names the tucked card, so nothing is cut.
  const { state, tucked } = withTuckedCard();

  const result = preview(state, attack(state, activeVillain(state).instanceId));
  expect(result.stop.kind).toBe("complete");
  expect(types(result.events)).toContain("damageDealt");
  expect(JSON.stringify(result.events)).not.toContain(`"${tucked}"`);
});

test("a preview that would turn a facedown card over stops there instead", () => {
  // Defeating the host discards the card tucked under it, faceup (RRG 1.8 "Tuck", p. 45) — exactly the reveal a
  // preview must not perform for free, since the `cardMoved`/`cardDiscardedFromPlay` events carry its `cardId`.
  const { state, minion, tucked } = withTuckedCard();

  const result = preview(state, attack(state, minion));
  expect(result.stop.kind).toBe("hiddenInformation");
  expect(JSON.stringify(result.events)).not.toContain(`"${tucked}"`);

  const real = applyCommand(state, attack(state, minion));
  expect(real.ok && real.state.instances[tucked]?.faceup).toBe(true);
});
