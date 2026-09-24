/**
 * docs/phase7-wave3.md §3.26 ("Players other than Gamora cannot remove threat from Sibling Rivalry", `gam` 18025):
 * `RuleSpec threatCannotBeRemoved` gains an optional `player` field scoping *who* is blocked, mirroring
 * `cannotAttack`'s own field. Proven with a synthetic two-player game rather than assumed from the shape of the
 * change alone (docs/card-scripting-process.md's own standing lesson).
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCards, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubEvent({ id: "blank-resource", cost: 0 });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });

// Only p2 is scoped by the rule: "players other than p1 cannot remove threat", i.e. `player` names p2.
const scoped = stubAbility("scoped", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] }, player: { kind: "id", playerId: p2 } },
    ],
  },
  effects: [],
});
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(10), targetThreat: flat(99), acceleration: flat(0), abilities: [scoped.ref] }],
});
const thwart = stubAbility("thwart", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
});
const THWART = stubEvent({ id: "thwart", cost: 0, abilities: [thwart.ref] });

const CARDS = [...DEFAULT_CARDS, VILLAIN, SCHEME, THWART, BLANK];
const deps = depsOf(scoped, thwart);

function game(): GameState {
  const identities = seatIdentities(HERO, 2);
  const result = createGame(
    {
      seed: 1,
      cards: [...CARDS, ...identities],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: copies(BLANK.id, 20),
      includeIdentitySets: false,
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK, THWART.id] })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};
const toHero = (player: typeof p1): Command => ({ type: "changeForm", playerId: player });
const play = (player: typeof p1, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});

describe("threatCannotBeRemoved's player field (docs/phase7-wave3.md §3.26)", () => {
  it("blocks removal only by a player the rule names, not every player", () => {
    const start = ok(game(), toHero(p1));
    const schemeId = start.mainScheme.instanceId;
    expect(mustInstance(start, schemeId).threat).toBe(10);

    // p1 is not scoped by the rule: their thwart removes threat as normal, on their own turn.
    const givenP1 = giveCards(start, p1, "thwart");
    const afterP1 = ok(givenP1.state, play(p1, givenP1.ids[0] as InstanceId));
    expect(mustInstance(afterP1, schemeId).threat).toBe(7);

    // p2 is named by the rule: their thwart is blocked entirely, on their own turn next.
    const p2Turn = ok(ok(afterP1, { type: "endTurn", playerId: p1 }), toHero(p2));
    const givenP2 = giveCards(p2Turn, p2, "thwart");
    const afterP2 = ok(givenP2.state, play(p2, givenP2.ids[0] as InstanceId));
    expect(mustInstance(afterP2, schemeId).threat).toBe(7);
  });

  it("an unscoped rule (no `player`) still blocks every player, as before this field existed", () => {
    const unscoped = stubAbility("unscoped", {
      trigger: { kind: "constant", rules: [{ kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] } }] },
      effects: [],
    });
    const scheme = stubMainScheme({
      id: "scheme-unscoped",
      stages: [{ startingThreat: flat(10), targetThreat: flat(99), acceleration: flat(0), abilities: [unscoped.ref] }],
    });
    const unscopedDeps = depsOf(unscoped, thwart);
    const identities = seatIdentities(HERO, 1);
    const result = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, VILLAIN, scheme, THWART, BLANK, ...identities],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: scheme.id,
        encounterDeck: copies(BLANK.id, 20),
        includeIdentitySets: false,
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK, THWART.id] })),
      },
      unscopedDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = runCommands(result.state, unscopedDeps).state;
    const schemeId = state.mainScheme.instanceId;
    const afterHero = applyCommand(state, { type: "changeForm", playerId: p1 }, unscopedDeps);
    if (!afterHero.ok) throw new Error(afterHero.error.message);
    const given = giveCards(afterHero.state, p1, "thwart");
    const played = applyCommand(
      given.state,
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: given.ids[0] as InstanceId,
        payment: [],
        attachToInstanceId: null,
      },
      unscopedDeps,
    );
    if (!played.ok) throw new Error(played.error.message);
    expect(mustInstance(played.state, schemeId).threat).toBe(10);
  });
});
