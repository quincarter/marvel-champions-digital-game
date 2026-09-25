/**
 * `EffectSpec.moveCards.assignOwnerTo` (this pass, Save the Shawarma Place's own printed text: "Each player shuffles
 * 1 copy of Shawarma into their deck", `mts` 21182a): `moveCardsTo`'s `"hand"`/`"deckTop"`/`"deckBottom"`/
 * `"deckShuffle"` destinations all read each card's own `ownerId` (`resolve/cards.ts`) and silently do nothing for a
 * card that has none — true of every card before this one, since a card sent to a player's hand or deck was always
 * already that player's own (their discard pile, their deck). Shawarma comes from the shared, unowned
 * `encounterSetAside` pool instead. `assignOwnerTo` sets the owner (and controller) of any such card to the given
 * player immediately before the move resolves, so `"deckShuffle"` (etc.) can then find it. Minimal, generic
 * addition: a card that already has an owner is untouched, so no existing script changes behavior.
 *
 * Sources: RRG 1.8 "Owner" (p. 31), "Deck" (p. 15).
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { Command } from "./commands.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMainScheme, stubResource, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, VILLAIN, defaultPick, giveCard, settle } from "./testing/scenario.js";

const p1 = playerId("p1");

/** A shared campaign card, unowned until granted — the Shawarma shape. */
const SHAWARMA = stubResource({ id: "shawarma-stub", icons: 1 });
const OTHER = stubTreachery({ id: "other" });

/** "Action: shuffle 1 copy of Shawarma into your deck" (stand-in for 21182a's own printed sentence). */
const GRANT_ABILITY = stubAbility("grant.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounterSetAside", filter: { name: SHAWARMA.name } },
      to: "deckShuffle",
      assignOwnerTo: { kind: "controller" },
    },
  ],
});
const GRANTOR = stubSupport({ id: "grantor", cost: 0, abilities: [GRANT_ABILITY.ref] });

const SETUP = stubAbility("assign-owner.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounter", zones: ["deck"], filter: { name: SHAWARMA.name } },
      to: "encounterSetAside",
    },
  ],
});
const SCHEME = stubMainScheme({
  id: "athena",
  stages: [
    {
      startingThreat: { base: 0, perPlayer: 0 },
      targetThreat: { base: 99, perPlayer: 0 },
      acceleration: { base: 0, perPlayer: 0 },
      aSideAbilities: [SETUP.ref],
    },
  ],
});

const deps: EngineDeps = depsOf(SETUP, GRANT_ABILITY);

function game(): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, GRANTOR, SCHEME, SHAWARMA, OTHER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [SHAWARMA.id, ...Array.from({ length: 10 }, () => OTHER.id)],
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, GRANTOR.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}

describe("moveCards assignOwnerTo", () => {
  it("assigns an owner to an unowned encounterSetAside card so deckShuffle can then find it", () => {
    const state = game();
    const [setAsideId] = state.encounterSetAside;
    if (!setAsideId) throw new Error("expected Shawarma to be set aside by setup");
    expect(mustInstance(state, setAsideId).ownerId).toBeNull();

    const given = giveCard(state, p1, GRANTOR.id);
    const grantorId = given.id;
    const played: Command = {
      type: "playCard",
      playerId: p1,
      cardInstanceId: grantorId,
      payment: [],
      attachToInstanceId: null,
    };
    const afterPlay = applyCommand(given.state, played, deps);
    if (!afterPlay.ok) throw new Error(afterPlay.error.message);
    const inPlayGrantorId = afterPlay.state.players
      .find((p) => p.playerId === p1)
      ?.playArea.find((id) => mustInstance(afterPlay.state, id).cardId === GRANTOR.id);
    if (!inPlayGrantorId) throw new Error("expected the grantor support in play");

    const used: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: inPlayGrantorId,
      abilityId: GRANT_ABILITY.ref.id,
      payment: [],
    };
    const afterUse = applyCommand(afterPlay.state, used, deps);
    if (!afterUse.ok) throw new Error(afterUse.error.message);

    expect(mustInstance(afterUse.state, setAsideId).ownerId).toBe(p1);
    expect(mustPlayer(afterUse.state, p1).deck).toContain(setAsideId);
    expect(afterUse.state.encounterSetAside).not.toContain(setAsideId);
  });
});
