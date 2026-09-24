/**
 * docs/phase7-wave3.md §3.26 ("Drax cannot attack minions", `gam` 18019): `RuleSpec cannotAttack` gains an optional
 * `attacker` field scoping *which character* is restricted, distinct from the existing `player` field (which
 * restricts a controller's every attack — Fear of Kang, Distracting Taunts, docs/phase7-wave2.md §25). A different
 * character the same player controls (their own hero) is unaffected, and — unlike a `player`-scoped rule — the
 * restriction reaches an enemy's own attack too, since it is asked about the attacker itself, not its controller.
 */
import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { canAttack } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubMinion, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, HERO, seatIdentities, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");

const cannotAttackMinions = stubAbility("drax-like", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "cannotAttack", target: { categories: ["minion"] }, attacker: { self: true } }],
  },
  effects: [],
});
const DRAX_LIKE = stubAlly({ id: "drax-like", cost: 0, atk: 3, thw: 0, hp: 4, abilities: [cannotAttackMinions.ref] });
const MINION = stubMinion({ id: "minion", atk: 1, sch: 1, hp: 3 });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});

const CARDS: readonly AnyCard[] = [...DEFAULT_CARDS, VILLAIN, SCHEME, DRAX_LIKE, MINION];
const deps: EngineDeps = depsOf(cannotAttackMinions);

/** Engages `cardId` (a minion in the encounter deck) with `player`, directly — the same surgery
 * `attachment-hosts.test.ts`'s own `intoPlay` uses for a minion. */
function engageMinion(
  state: GameState,
  cardId: CardId,
  player = p1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((candidate) => state.instances[candidate]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId} in the encounter deck`);
  return {
    id,
    state: {
      ...withEncounterPiles(state, { deck: deck.filter((x) => x !== id) }),
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true, engagedWith: player } },
    },
  };
}

/** Puts an owned deck card straight into its owner's play area, controlled by them — the ally-side twin of
 * `engageMinion`, for a card this test doesn't need a real `playCard` to exercise. */
function putAllyInPlay(
  state: GameState,
  cardId: CardId,
  player = p1,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = mustPlayer(state, player);
  const id =
    owner.deck.find((candidate) => state.instances[candidate]?.cardId === cardId) ??
    owner.hand.find((candidate) => state.instances[candidate]?.cardId === cardId);
  if (!id) throw new Error(`${player} has no ${cardId} in their deck or hand`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              deck: p.deck.filter((x) => x !== id),
              hand: p.hand.filter((x) => x !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true, controllerId: player } },
    },
  };
}

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 1,
      cards: [...CARDS, ...identities],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [MINION.id],
      includeIdentitySets: false,
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [DRAX_LIKE.id] })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

describe("RuleSpec cannotAttack's attacker field (docs/phase7-wave3.md §3.26)", () => {
  it("restricts the named character only, not the whole controlling player", () => {
    const start = game();
    const engaged = engageMinion(start, MINION.id);
    const withDrax = putAllyInPlay(engaged.state, DRAX_LIKE.id);
    const identityId = mustPlayer(withDrax.state, p1).identity.instanceId;

    expect(canAttack(withDrax.state, withDrax.id, engaged.id, deps)).toBe(false);
    // The player's own hero (a different attacker) is unaffected by a rule scoped to Drax specifically.
    expect(canAttack(withDrax.state, identityId, engaged.id, deps)).toBe(true);
    // Drax may still attack the villain — the rule names minions only.
    const villainId = activeVillain(withDrax.state).instanceId;
    expect(canAttack(withDrax.state, withDrax.id, villainId, deps)).toBe(true);
  });
});
