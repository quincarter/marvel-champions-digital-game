/**
 * docs/phase7-wave6.md §3.71: an ally with an encounter card back under a player's control. Synthetic cards shaped like
 * Longshot (`mojo` 39071: "Longshot does not count against your ally limit. When Revealed: Put Longshot into play under
 * your control. This card gains surge. This effect cannot be canceled."; MojoMania insert p. 2: "The Longshot ally card
 * has an encounter card back") and a Captive ally (`mut_gen` 32089–32092) that counts against the limit.
 *
 * Sources: RRG 1.8 "Ownership and Control" (p. 31): the scenario owns each encounter card, and only a scenario-specific
 * player card "with a player card back" changes owner when a player takes control of it; "Ally Limit"; "Surge" (p. 42).
 * Decisions: §4 Q41 (he leaves play to the encounter discard pile and can be revealed again), Q14 (in the campaign a
 * Captive ally is the player's for the game), Q42 (ruling Apr 30, 2026 (3) #1: revealed at setup, his When Revealed,
 * surge included, resolves in full).
 */

import type { AllyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, cardBackOf, discardZoneFor, locateCard, mustInstance, mustPlayer } from "./query.js";
import { boostIconsFor } from "./modifiers.js";
import { isPlayerCard } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMainScheme } from "./testing/fixtures.js";
import {
  ALLY,
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  HERO,
  seatIdentities,
  TREACHERY,
  VILLAIN,
} from "./testing/scenario.js";
import { copiesOf, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import { giveCard } from "./testing/scenario.js";

const LONGSHOT_LIMIT = stubAbility("longshot.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
const LONGSHOT_REVEALED = stubAbility("longshot.when-revealed", {
  trigger: { kind: "whenRevealed" },
  uncancellable: true,
  effects: [{ kind: "gainSurge" }],
});
const LONGSHOT: AllyCard = {
  ...stubAlly({
    id: "longshot",
    cost: 0,
    atk: 2,
    thw: 2,
    hp: 3,
    abilities: [LONGSHOT_LIMIT.ref, LONGSHOT_REVEALED.ref],
  }),
  name: "Longshot",
  unique: true,
  cardBack: "encounter",
};
/** An encounter-backed ally that counts against the ally limit (a Captive ally's shape), cost 0. */
const CAPTIVE: AllyCard = {
  ...stubAlly({ id: "captive", cost: 0, atk: 1, thw: 1, hp: 3 }),
  name: "Captive",
  unique: true,
  cardBack: "encounter",
};

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const revealFor = (id: string, player: PlayerId) =>
  action(id, [{ kind: "revealEncounterCard", player: { kind: "id", playerId: player } }]);
const REVEAL = revealFor("reveal", P1);
const P2_REVEALS = revealFor("p2-reveals", P2);
const smite = (name: string) =>
  action(`smite-${name}`, [
    { kind: "dealDamage", target: { kind: "named", name }, amount: { kind: "const", value: 3 } },
  ]);
const SMITE_LONGSHOT = smite("Longshot");
const SMITE_CAPTIVE = smite("Captive");
/** Q14's campaign instruction, as an effect: the set-aside Captive ally becomes this player's, in their hand. */
const ADOPT = action("adopt", [
  {
    kind: "moveCards",
    cards: { kind: "encounterSetAside", filter: { name: "Captive" } },
    to: "hand",
    assignOwnerTo: { kind: "controller" },
  },
]);
const ACTIONS = [REVEAL, P2_REVEALS, SMITE_LONGSHOT, SMITE_CAPTIVE, ADOPT];

/** Q42: the campaign's "one player may reveal him" during setup, from the set-aside cards. */
const REVEAL_AT_SETUP = stubAbility("scheme.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "longshot", cards: { kind: "encounterSetAside", filter: { name: "Longshot" } } },
    { kind: "revealCard", cards: { kind: "slot", slot: "longshot" }, player: { kind: "firstPlayer" } },
  ],
});
const SETUP_SCHEME = stubMainScheme({
  id: "setup-scheme",
  stages: [
    {
      startingThreat: { base: 0, perPlayer: 0 },
      targetThreat: { base: 99, perPlayer: 0 },
      acceleration: { base: 0, perPlayer: 0 },
      aSideAbilities: [REVEAL_AT_SETUP.ref],
    },
  ],
});

const deps: EngineDeps = depsOf(LONGSHOT_LIMIT, LONGSHOT_REVEALED, REVEAL_AT_SETUP, ...ACTIONS.map((a) => a.ability));

function start(options: {
  readonly encounter: readonly CardId[];
  readonly setAside?: readonly CardId[];
  readonly setupScheme?: true;
}): { readonly state: GameState; readonly setupEvents: readonly GameEvent[] } {
  const identities = seatIdentities(HERO, 2);
  const scheme = options.setupScheme ? SETUP_SCHEME : DEFAULT_CARDS.find((card) => card.type === "main_scheme")!;
  const result = createGame(
    {
      seed: 7,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), SETUP_SCHEME, LONGSHOT, CAPTIVE, ...ACTIONS.map((a) => a.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: options.encounter,
      ...(options.setAside ? { setAside: options.setAside } : {}),
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 3))],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { state: driveSession(startSession(result.state), deps).session.state, setupEvents: result.events };
}

const idOf = (state: GameState, cardId: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === cardId)!.instanceId;
const encounterPiles = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
/**
 * P1 plays a reveal event (P1 reveals, or "P2 reveals") and every choice is answered with `defaultPick`, recording the
 * prompts asked.
 */
function reveal(state: GameState, by = REVEAL) {
  const prompts: string[] = [];
  const player = P1;
  const given = giveCard(state, player, by.card.id);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    (current) => {
      if (current.pendingChoice) prompts.push(current.pendingChoice.prompt.kind);
      return defaultPick(current);
    },
  );
  return { session, state: session.state, events, prompts };
}

describe("§3.71 an ally with an encounter card back", () => {
  it("reads its back: written for an exception, otherwise from its type", () => {
    expect(cardBackOf(LONGSHOT)).toBe("encounter");
    expect(cardBackOf(ALLY)).toBe("player");
    expect(cardBackOf(TREACHERY)).toBe("encounter");
  });

  it("turned faceup as a boost card, it has no boost icons (MojoMania insert p. 2)", () => {
    const state = start({ encounter: [LONGSHOT.id, ...copiesOf(TREACHERY.id, 6)] }).state;
    expect(boostIconsFor(state, deps, idOf(state, LONGSHOT.id))).toBe(0);
  });

  it("revealed, it enters play under the revealing player's control, stays the scenario's, and surges", () => {
    const encounter = [LONGSHOT.id, ...copiesOf(TREACHERY.id, 6)];
    const before = onTopOfEncounterDeck(start({ encounter }).state, LONGSHOT.id);
    const deckBefore = encounterPiles(before).deck.length;
    const { state, events, session } = reveal(before);
    const longshot = idOf(state, LONGSHOT.id);
    expect(mustPlayer(state, P1).playArea).toContain(longshot);
    const instance = mustInstance(state, longshot);
    expect(instance.controllerId).toBe(P1);
    expect(instance.ownerId).toBeNull();
    expect(instance.home).toEqual({ kind: "encounterDeck", deckId: activeEncounterDeckId(state) });
    expect(events.some((e) => e.type === "ownershipChanged")).toBe(false);
    // An ally is a player card (RRG 1.8 "Player Card", p. 33) whoever owns it: "by player card effects" includes it.
    expect(isPlayerCard(state, longshot)).toBe(true);
    // Surge: P1 revealed one more card, a treachery, discarded to the encounter discard pile.
    expect(events).toContainEqual({ type: "surgeTriggered", instanceId: longshot, playerId: P1 });
    expect(encounterPiles(state).deck.length).toBe(deckBefore - 2);
    expect(encounterPiles(state).discard.map((id) => mustInstance(state, id).cardId)).toEqual([TREACHERY.id]);
    expect(discardZoneFor(state, longshot)).toEqual({
      kind: "encounterDiscard",
      deckId: activeEncounterDeckId(state),
    });
    expectReplays(session);
  });

  it("follows its own text on the ally limit: Longshot is excluded, a Captive ally counts", () => {
    let base = start({ encounter: [LONGSHOT.id, CAPTIVE.id, ...copiesOf(TREACHERY.id, 6)] }).state;
    for (let i = 0; i < 3; i++) base = playerCardIntoPlay(base, ALLY.id, P1).state;
    const longshot = reveal(onTopOfEncounterDeck(base, LONGSHOT.id));
    expect(longshot.prompts).not.toContain("discardOverAllyLimit");
    expect(mustPlayer(longshot.state, P1).playArea).toContain(idOf(longshot.state, LONGSHOT.id));

    const captive = reveal(onTopOfEncounterDeck(base, CAPTIVE.id));
    expect(captive.prompts).toContain("discardOverAllyLimit");
    // Four allies over a limit of three: one discarded (`defaultPick` takes the first offered, an owned ally).
    const allies = mustPlayer(captive.state, P1).playArea.filter((id) =>
      [ALLY.id, CAPTIVE.id].includes(mustInstance(captive.state, id).cardId),
    );
    expect(allies).toHaveLength(3);
    expectReplays(captive.session);
  });

  it("defeated, it goes to the encounter discard pile, is reshuffled with it and revealed again by another player", () => {
    // One treachery under him: his surge takes it and empties the encounter deck.
    const encounter = [LONGSHOT.id, TREACHERY.id];
    const revealed = reveal(onTopOfEncounterDeck(start({ encounter }).state, LONGSHOT.id)).state;
    const longshot = idOf(revealed, LONGSHOT.id);
    expect(encounterPiles(revealed).deck).toEqual([]);

    const defeated = playFree(revealed, deps, SMITE_LONGSHOT.card.id);
    const state = defeated.state;
    expect(defeated.events).toContainEqual(
      expect.objectContaining({ type: "characterDefeated", instanceId: longshot }),
    );
    expect(locateCard(state, longshot)).toEqual({ kind: "encounterDiscard", deckId: activeEncounterDeckId(state) });
    expect(mustPlayer(state, P1).discard).not.toContain(longshot);
    // Back on the scenario's side: nobody's, and nobody controls it.
    expect(mustInstance(state, longshot)).toMatchObject({ ownerId: null, controllerId: null, damage: 0 });
    expectReplays(defeated.session);

    // P2 reveals from the empty deck: the discard pile, Longshot in it, is shuffled back in (an acceleration token is
    // placed) and the top card revealed. With the treachery on top, Longshot waits for P2's next reveal.
    let again = reveal(state, P2_REVEALS);
    expect(again.state.mainScheme.accelerationTokens).toBe(state.mainScheme.accelerationTokens + 1);
    if (!mustPlayer(again.state, P2).playArea.includes(longshot)) {
      expect(locateCard(again.state, longshot)).toEqual({
        kind: "encounterDeck",
        deckId: activeEncounterDeckId(state),
      });
      again = reveal(again.state, P2_REVEALS);
    }
    expect(mustPlayer(again.state, P2).playArea).toContain(longshot);
    expect(mustInstance(again.state, longshot)).toMatchObject({ ownerId: null, controllerId: P2 });
    expect(again.events).toContainEqual({ type: "surgeTriggered", instanceId: longshot, playerId: P2 });
    expectReplays(again.session);
  });

  it("in the campaign (Q14) it is the player's for the game: played from their hand, defeated to their discard pile", () => {
    const base = start({ encounter: copiesOf(TREACHERY.id, 6), setAside: [CAPTIVE.id] }).state;
    const captive = idOf(base, CAPTIVE.id);
    expect(locateCard(base, captive)).toEqual({ kind: "encounterSetAside" });

    const adopted = playFree(base, deps, ADOPT.card.id);
    expect(adopted.events).toContainEqual({ type: "ownershipChanged", instanceId: captive, playerId: P1 });
    expect(mustInstance(adopted.state, captive)).toMatchObject({
      ownerId: P1,
      controllerId: P1,
      home: { kind: "player" },
    });
    expect(mustPlayer(adopted.state, P1).hand).toContain(captive);

    const played = driveSession(startSession(adopted.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: captive, payment: [], attachToInstanceId: null },
    ]).session.state;
    expect(mustPlayer(played, P1).playArea).toContain(captive);

    const defeated = playFree(played, deps, SMITE_CAPTIVE.card.id);
    expect(locateCard(defeated.state, captive)).toEqual({ kind: "discard", playerId: P1 });
    expect(mustInstance(defeated.state, captive)).toMatchObject({ ownerId: P1, controllerId: P1 });
    expectReplays(defeated.session);
  });

  it("revealed during setup (Q42), his When Revealed resolves in full: in play under the first player, and he surges", () => {
    const { state, setupEvents } = start({
      encounter: copiesOf(TREACHERY.id, 6),
      setAside: [LONGSHOT.id],
      setupScheme: true,
    });
    const longshot = idOf(state, LONGSHOT.id);
    expect(mustPlayer(state, P1).playArea).toContain(longshot);
    expect(mustInstance(state, longshot)).toMatchObject({ ownerId: null, controllerId: P1 });
    expect(setupEvents).toContainEqual({ type: "surgeTriggered", instanceId: longshot, playerId: P1 });
    expect(encounterPiles(state).deck).toHaveLength(5);
    expect(encounterPiles(state).discard.map((id) => mustInstance(state, id).cardId)).toEqual([TREACHERY.id]);
  });
});
