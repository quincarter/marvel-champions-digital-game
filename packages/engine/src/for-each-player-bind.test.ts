/**
 * `forEachPlayer` `bind`: each player's pass hands its vars back to the ability under `<bind>.`, summed across the
 * passes, so one effect after the loop acts on what every player did together ("Each player may spend up to 3
 * [physical] resources … Deal 2 damage to Thanos for each [physical] resource spent this way", Sanctuary, `mts` 21116:
 * one damage instance, not one per player). Proven with synthetic cards: each pass records its player's hand size as
 * `size`, and the effect after the loop places that many threat on the main scheme.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  giveCard,
  HERO,
  MAIN_SCHEME,
  seatIdentities,
  VILLAIN,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

/** Each pass: `size` = that player's hand size; `seen` = what the earlier passes handed back (a pass never sees it). */
const PASS: readonly EffectSpec[] = [
  { kind: "setVar", name: "size", value: { kind: "handCount", player: { kind: "scoped" } } },
  { kind: "setVar", name: "seen", value: { kind: "var", name: "all.size" } },
];
const threatFrom = (name: string): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "var", name },
});
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const loop = (id: string, extra: Partial<Extract<EffectSpec, { kind: "forEachPlayer" }>>, read: string) =>
  actionEvent(id, [{ kind: "forEachPlayer", players: { kind: "each" }, effects: PASS, ...extra }, threatFrom(read)]);
const BOUND = loop("bound", { bind: "all" }, "all.size");
const BOUND_CHOSEN = loop("bound-chosen", { bind: "all", order: "firstPlayerChooses" }, "all.size");
const SEEN = loop("seen", { bind: "all" }, "all.seen");
const UNBOUND = loop("unbound", {}, "all.size");
const UNBOUND_OWN = loop("unbound-own", {}, "size");
/** The ability holds `x` = 3 before the loop; each pass reads it into `y` and leaves `x` alone. */
const INHERITED = actionEvent("inherited", [
  { kind: "setVar", name: "x", value: { kind: "const", value: 3 } },
  {
    kind: "forEachPlayer",
    players: { kind: "each" },
    effects: [{ kind: "setVar", name: "y", value: { kind: "var", name: "x" } }],
    bind: "all",
  },
  threatFrom("all.x"),
]);
const INHERITED_READ = actionEvent("inherited-read", [
  ...INHERITED.ability.definition.effects.slice(0, 2),
  threatFrom("all.y"),
]);
/** Only the player whose turn it is (P1) sets `only`; each pass binds its player's identity into `who`. */
const PARTIAL: readonly EffectSpec[] = [
  {
    kind: "if",
    condition: { kind: "turnOf", player: { kind: "scoped" } },
    then: [{ kind: "setVar", name: "only", value: { kind: "const", value: 5 } }],
  },
  { kind: "selectCards", slot: "who", cards: { kind: "ref", ref: { kind: "identityOf", player: { kind: "scoped" } } } },
];
const ONE_SETS = loop("one-sets", { bind: "all", effects: PARTIAL }, "all.only");
const JOINED = actionEvent("joined", [
  { kind: "forEachPlayer", players: { kind: "each" }, effects: PARTIAL, bind: "all" },
  { kind: "dealDamage", target: { kind: "slot", slot: "all.who" }, amount: { kind: "const", value: 1 } },
]);
const EVENTS = [BOUND, BOUND_CHOSEN, SEEN, UNBOUND, UNBOUND_OWN, INHERITED, INHERITED_READ, ONE_SETS, JOINED];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function game(): GameState {
  const identities = seatIdentities(HERO, 2);
  const config: GameSetupConfig = {
    seed: 7,
    cards: [...DEFAULT_CARDS, VILLAIN, MAIN_SCHEME, BLANK, ...identities, ...EVENTS.map((e) => e.card)],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: copies(BLANK.id, 16),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  // Two more cards in P2's hand, so the two passes record different sizes.
  const settled = runCommands(result.state, deps).state;
  return giveCard(giveCard(settled, p2, SEEN.card.id).state, p2, UNBOUND.card.id).state;
}

function play(state: GameState, card: { readonly id: CardId }): GameState {
  const given = giveCard(state, p1, card.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const threat = (state: GameState) => state.instances[state.mainScheme.instanceId]!.threat;
/** Both hands once the event has left P1's (resolution changes no hand). */
const handSizes = (state: GameState) => mustPlayer(state, p1).hand.length + mustPlayer(state, p2).hand.length;

describe("forEachPlayer bind: the passes' vars come back to the ability, summed", () => {
  it("in player order: the effect after the loop reads the sum of both players' passes", () => {
    const start = game();
    const done = play(start, BOUND.card);
    expect(mustPlayer(done, p1).hand.length).not.toBe(mustPlayer(done, p2).hand.length);
    expect(threat(done) - threat(start)).toBe(handSizes(done));
  });

  it("in an order the first player chooses: the same sum", () => {
    const start = game();
    const done = play(start, BOUND_CHOSEN.card);
    expect(threat(done) - threat(start)).toBe(handSizes(done));
  });

  it("a pass starts without what the earlier passes handed back", () => {
    const start = game();
    expect(threat(play(start, SEEN.card))).toBe(threat(start));
  });

  it("a var the ability held before the loop is not handed back once per pass; one a pass set from it is", () => {
    const start = game();
    expect(threat(play(start, INHERITED.card))).toBe(threat(start));
    expect(threat(play(start, INHERITED_READ.card)) - threat(start)).toBe(6);
  });

  it("a var only one pass sets comes back as that pass's; slots are joined across the passes", () => {
    const start = game();
    expect(threat(play(start, ONE_SETS.card)) - threat(start)).toBe(5);
    const identities = [p1, p2].map((p) => mustPlayer(start, p).identity.instanceId);
    const done = play(start, JOINED.card);
    for (const id of identities) expect(done.instances[id]!.damage).toBe(start.instances[id]!.damage + 1);
  });

  it("without bind, nothing comes back: neither `<bind>.size` nor the pass's own `size`", () => {
    const start = game();
    expect(threat(play(start, UNBOUND.card))).toBe(threat(start));
    expect(threat(play(start, UNBOUND_OWN.card))).toBe(threat(start));
  });
});
