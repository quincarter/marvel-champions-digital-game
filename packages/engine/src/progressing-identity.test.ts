/**
 * docs/phase7-wave5.md §1.4, §3.23: progressing identities (the Ironheart insert, "New Rules: Progressing Identity
 * Cards"): "the weakest of the cards is put into play under the player's control, with the other two cards set aside
 * … All versions of the Ironheart / Riri Williams identity share a single hit point dial … when one identity is swapped
 * for another, move all game elements … on or attached to the original identity to the subsequent identity."
 * Synthetic cards shaped like Ironheart V1–V3 (`ironheart` 29001a–29003a) and "X is equal to Ironheart's [Version]
 * number" (Photon Blasters, 29012).
 *
 * Source: RRG 1.8 "Swap" (p. 42): neither card enters or leaves play; the dial keeps its value.
 */

import { cardId, trait, type DeckContents, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { validateDeck } from "./deck.js";
import { replay, startSession } from "./engine.js";
import { handSize, maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { P1 } from "./testing/wave3.js";

const VERSIONS = [cardId("iron-v1"), cardId("iron-v2"), cardId("iron-v3")] as const;
const LEVEL_UP = stubAbility("iron.level-up", {
  trigger: { kind: "action" },
  effects: [{ kind: "swapIdentity", player: { kind: "controller" } }],
});
const MEASURE = stubAbility("iron.measure", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "measured",
      amount: { kind: "traitNumber", of: { kind: "identityOf", player: { kind: "controller" } }, prefix: "Version" },
    },
  ] as EffectSpec[],
});
const version = (n: 1 | 2 | 3): HeroIdentityCard => ({
  ...stubIdentity({
    id: `iron-v${n}`,
    hp: 8 + 2 * n,
    atk: 2,
    thw: n,
    def: 3,
    rec: 3,
    heroHandSize: 3 + n,
    alterEgoHandSize: 6,
    heroTraits: [trait(`VERSION ${n}`)],
    heroAbilities: [LEVEL_UP.ref, MEASURE.ref],
    alterEgoAbilities: [MEASURE.ref],
  }),
  progressingIdentity: { versions: VERSIONS },
});
const [V1, V2, V3] = [version(1), version(2), version(3)];

const deps: EngineDeps = depsOf(LEVEL_UP, MEASURE);
const config = (identity: HeroIdentityCard): GameSetupConfig => ({
  seed: 1,
  cards: [...DEFAULT_CARDS, V1, V2, V3],
  villainCardId: VILLAIN.id,
  mainSchemeCardId: MAIN_SCHEME.id,
  encounterDeck: [],
  includeIdentitySets: false,
  players: [{ identityCardId: identity.id, deck: DEFAULT_DECK }],
});

function start(): GameState {
  const result = createGame(config(V1), deps);
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const identityOf = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId);
const use = (state: GameState, ability: typeof LEVEL_UP) =>
  driveSession(startSession(state), deps, [
    {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: mustPlayer(state, P1).identity.instanceId,
      abilityId: ability.ref.id,
      payment: [],
    },
  ]);

describe("§3.23 setup: the first version in play, the others set aside", () => {
  it("seats the first version and sets the later ones aside; refuses a later version as the seat", () => {
    const state = start();
    expect(mustPlayer(state, P1).identity.cardId).toBe(V1.id);
    const aside = mustPlayer(state, P1).setAside.map((id) => mustInstance(state, id).cardId);
    expect(aside).toEqual([V2.id, V3.id]);
    const later = createGame(config(V2), deps);
    expect(later.ok ? null : later.error.message).toMatch(/later version/);
  });

  it("validateDeck accepts the first version and names it for a later one", () => {
    const problems = (identity: HeroIdentityCard) => {
      const deck: DeckContents = { identityCardId: identity.id, aspects: ["leadership"], cards: [] };
      const verdict = validateDeck(deck, [V1, V2, V3]);
      return verdict.ok ? [] : verdict.problems.filter((p) => p.code === "unsupported_identity").map((p) => p.message);
    };
    expect(problems(V1)).toEqual([]);
    expect(problems(V2)).toEqual([expect.stringMatching(/a deck names its first version/)]);
  });
});

describe("§3.23 'swap her with [Version 2] Ironheart'", () => {
  it("keeps the dial, counters, statuses and form, and takes the new card's hit points and hand size; replay deep-equal", () => {
    const base = start();
    const id = mustPlayer(base, P1).identity.instanceId;
    const hero: GameState = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" } } : p)),
      instances: {
        ...base.instances,
        [id]: {
          ...mustInstance(base, id),
          damage: 3,
          counters: { progress: 2 },
          statuses: { stunned: 0, confused: 0, tough: 1 },
        },
      },
    };
    const { session, events } = use(hero, LEVEL_UP);
    const after = session.state;
    const seat = mustPlayer(after, P1);
    expect(seat.identity).toMatchObject({ instanceId: id, cardId: V2.id, form: "hero" });
    expect(identityOf(after)).toMatchObject({ cardId: V2.id, damage: 3, counters: { progress: 2 } });
    expect(identityOf(after).statuses.tough).toBe(1);
    expect(maxHitPoints(after, id)).toBe(12);
    expect(handSize(after, P1, deps)).toBe(5);
    expect(seat.setAside.map((i) => mustInstance(after, i).cardId)).toEqual([V1.id, V3.id]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "identitySwapped", fromCardId: V1.id, toCardId: V2.id }),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the last version has nothing to swap to", () => {
    const base = start();
    const hero: GameState = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" } } : p)),
    };
    const twice = use(use(hero, LEVEL_UP).session.state, LEVEL_UP).session.state;
    const readied = {
      ...twice,
      instances: {
        ...twice.instances,
        [mustPlayer(twice, P1).identity.instanceId]: { ...identityOf(twice), exhausted: false },
      },
    };
    expect(mustPlayer(readied, P1).identity.cardId).toBe(V3.id);
    expect(mustPlayer(use(readied, LEVEL_UP).session.state, P1).identity.cardId).toBe(V3.id);
  });
});

describe("§3.23 'X is equal to Ironheart's [Version] number'", () => {
  it("reads the showing face's trait, and the printed hero face from the alter-ego", () => {
    const base = start();
    expect(identityOf(use(base, MEASURE).session.state).counters["measured"]).toBe(1);
  });
});
