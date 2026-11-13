/**
 * `CardSelector ref { random }`: a pick at random among the cards a ref names, in play included. "Discard 1 upgrade
 * you control at random" ("Hello Again", community pack `gwenpool-ptt` 15, source commit 3a5dff953e) is
 * `selectCards(slot, { kind: "ref", ref: each(... you control), random: 1 })` then `discardFromPlay(slot)`; here on
 * synthetic supports, as a player card's effect and as a treachery's When Revealed (where "you" is the revealing
 * player).
 *
 * The pick is one draw on the game's seeded RNG per card (`GameState.rng`), so a replay of the command log picks the
 * same card; an empty pool draws nothing. A `ref` selector without `random` is unchanged (no draw).
 *
 * Synthetic cards only.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const yourSupports: TargetQuery = { categories: ["support"], controller: "you" };
const randomOf = (query: TargetQuery, count: number, more: Partial<CardSelector> = {}): CardSelector =>
  ({ kind: "ref", ref: { kind: "each", query }, random: { kind: "const", value: count }, ...more }) as CardSelector;
const discardPicked = (selector: CardSelector): readonly EffectSpec[] => [
  { kind: "selectCards", slot: "picked", cards: selector },
  { kind: "discardFromPlay", target: { kind: "slot", slot: "picked" } },
];

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });
/** "Discard 1 support you control at random." */
const CULL_ACTION = action("cull.action", discardPicked(randomOf(yourSupports, 1)));
/** "Discard 2 supports you control at random." / "… 9 …" (more than there are). */
const CULL_TWO_ACTION = action("cull-two.action", discardPicked(randomOf(yourSupports, 2)));
const CULL_ALL_ACTION = action("cull-all.action", discardPicked(randomOf(yourSupports, 9)));
/** "Discard 1 Gadget support you control at random": the filter narrows the pool before the pick. */
const CULL_GADGET_ACTION = action(
  "cull-gadget.action",
  discardPicked(randomOf(yourSupports, 1, { filter: { name: "gadget" } } as Partial<CardSelector>)),
);
/** "Discard each support you control." (no `random`: every one, no RNG draw). */
const CLEAR_ACTION = action("clear.action", discardPicked({ kind: "ref", ref: { kind: "each", query: yourSupports } }));
const REVEAL_ACTION = action("reveal.action", [{ kind: "revealEncounterCard", player: you }]);
/** "When Revealed: discard 1 support you control at random." */
const GREMLIN_REVEALED = stubAbility("gremlin.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: discardPicked(randomOf(yourSupports, 1)),
});

const GADGET = stubSupport({ id: "gadget", cost: 0 });
const TRINKET = stubSupport({ id: "trinket", cost: 0 });
const GREMLIN = stubTreachery({ id: "gremlin", boostIcons: 0, abilities: [GREMLIN_REVEALED.ref] });
const event = (id: string, ability: typeof CULL_ACTION) => stubEvent({ id, cost: 0, abilities: [ability.ref] });
const CULL = event("cull", CULL_ACTION);
const CULL_TWO = event("cull-two", CULL_TWO_ACTION);
const CULL_ALL = event("cull-all", CULL_ALL_ACTION);
const CULL_GADGET = event("cull-gadget", CULL_GADGET_ACTION);
const CLEAR = event("clear", CLEAR_ACTION);
const REVEAL = event("reveal", REVEAL_ACTION);
const EVENTS = [CULL, CULL_TWO, CULL_ALL, CULL_GADGET, CLEAR, REVEAL];

const deps: EngineDeps = depsOf(
  CULL_ACTION,
  CULL_TWO_ACTION,
  CULL_ALL_ACTION,
  CULL_GADGET_ACTION,
  CLEAR_ACTION,
  REVEAL_ACTION,
  GREMLIN_REVEALED,
);

interface Table {
  readonly state: GameState;
  /** P1's supports in play, in the order they entered. */
  readonly mine: readonly InstanceId[];
  /** P2's supports in play (two-player tables only). */
  readonly theirs: readonly InstanceId[];
}

/** P1 controls the named supports; with `players: 2`, P2 controls two gadgets too. */
function table(
  supports: readonly ("gadget" | "trinket")[],
  options: { readonly seed?: number; readonly players?: 1 | 2 } = {},
): Table {
  let state = gameAtFirstTurn({
    cards: [GADGET, TRINKET, GREMLIN, ...EVENTS],
    deps,
    deck: [...copiesOf(GADGET.id, 3), ...copiesOf(TRINKET.id, 3), ...EVENTS.map((e) => e.id)],
    encounter: copiesOf(GREMLIN.id, 10),
    players: options.players ?? 1,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  });
  const place = (player: PlayerId, names: readonly string[]): InstanceId[] =>
    names.map((name) => {
      const placed = playerCardIntoPlay(state, name as never, player);
      state = placed.state;
      return placed.id;
    });
  const mine = place(P1, supports);
  const theirs = options.players === 2 ? place(P2, ["gadget", "gadget"]) : [];
  return { state, mine, theirs };
}

const inPlay = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).playArea;
const discarded = (state: GameState, ids: readonly InstanceId[], player: PlayerId = P1) =>
  ids.filter((id) => mustPlayer(state, player).discard.includes(id));
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("a random pick among cards in play (CardSelector ref.random)", () => {
  it("1 of 3 at random: exactly one is discarded, by one RNG draw, and the replay is identical", () => {
    const t = table(["gadget", "gadget", "trinket"]);
    const { state, session } = playFree(t.state, deps, CULL.id);
    const gone = discarded(state, t.mine);
    expect(gone).toHaveLength(1);
    expect(inPlay(state)).toEqual(expect.arrayContaining(t.mine.filter((id) => id !== gone[0])));
    expect(state.rng).not.toEqual(t.state.rng);
    expectReplays(session);
  });

  it("the pick follows the seed: the same seed picks the same card, and seeds 1 to 40 reach each of the three", () => {
    const pickOf = (seed: number) => {
      const t = table(["gadget", "gadget", "trinket"], { seed });
      const { state } = playFree(t.state, deps, CULL.id);
      return t.mine.findIndex((id) => mustPlayer(state, P1).discard.includes(id));
    };
    expect(pickOf(21)).toBe(pickOf(21));
    const reached = new Set(Array.from({ length: 40 }, (_, i) => pickOf(i + 1)));
    expect([...reached].sort()).toEqual([0, 1, 2]);
  });

  it("nothing you control: nothing is discarded and the RNG is not drawn", () => {
    const t = table([]);
    const { state, session } = playFree(t.state, deps, CULL.id);
    expect(mustPlayer(state, P1).discard.filter((id) => state.instances[id]?.cardId === GADGET.id)).toEqual([]);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("2 of 3 at random: two different cards; 9 of 2: both and no more", () => {
    const two = table(["gadget", "trinket", "gadget"]);
    expect(discarded(playFree(two.state, deps, CULL_TWO.id).state, two.mine)).toHaveLength(2);
    const all = table(["gadget", "trinket"]);
    const { state, session } = playFree(all.state, deps, CULL_ALL.id);
    expect(discarded(state, all.mine)).toEqual(all.mine);
    expectReplays(session);
  });

  it("a filter narrows the pool: 2 trinkets and 1 gadget, 1 random gadget is always the gadget", () => {
    const t = table(["trinket", "gadget", "trinket"]);
    const { state, session } = playFree(t.state, deps, CULL_GADGET.id);
    expect(discarded(state, t.mine)).toEqual([t.mine[1]]);
    expectReplays(session);
  });

  it("a ref selector without random names every card and draws nothing", () => {
    const t = table(["gadget", "trinket"]);
    const { state } = playFree(t.state, deps, CLEAR.id);
    expect(discarded(state, t.mine)).toEqual(t.mine);
    expect(state.rng).toEqual(t.state.rng);
  });

  it("as a treachery's When Revealed: only the revealing player's cards are in the pool", () => {
    const t = table(["gadget", "trinket"], { players: 2 });
    const { state, session } = playFree(onTopOfEncounterDeck(t.state, GREMLIN.id), deps, REVEAL.id);
    expect(discarded(state, t.mine)).toHaveLength(1);
    expect(inPlay(state, P2)).toEqual(expect.arrayContaining([...t.theirs]));
    expect(discarded(state, t.theirs, P2)).toEqual([]);
    expectReplays(session);
  });
});
