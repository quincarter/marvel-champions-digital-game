/**
 * docs/phase7-wave3.md §3.26 ("against a unique enemy", Godslayer, `gam` 18018): `TargetQuery.unique` reads the same
 * printed fact `unique.ts`'s `isUnique` uses for the deckbuilding unique rule (RRG 1.8 "Unique", p. 46) — a card's
 * own printed icon, or a hero identity regardless of its own icon.
 */
import { flat, type AnyCard, type MinionCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { explainQuery, matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import { depsOf } from "./testing/abilities.js";
import { stubMainScheme, stubMinion, stubVillain } from "./testing/fixtures.js";
import { runCommands } from "./testing/drive.js";
import { DEFAULT_CARDS, HERO, seatIdentities } from "./testing/scenario.js";
import { playerId } from "./ids.js";

const p1 = playerId("p1");
const deps: EngineDeps = depsOf();
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const PLAIN_MINION = stubMinion({ id: "plain-minion", atk: 1, sch: 1, hp: 3 });
const UNIQUE_MINION: MinionCard = { ...stubMinion({ id: "unique-minion", atk: 1, sch: 1, hp: 3 }), unique: true };

describe("TargetQuery.unique (docs/phase7-wave3.md §3.26)", () => {
  it("matches a card printing the unique icon, and every hero identity regardless of its own icon", () => {
    const identities = seatIdentities(HERO, 1);
    const cards: readonly AnyCard[] = [...DEFAULT_CARDS, VILLAIN, SCHEME, PLAIN_MINION, UNIQUE_MINION, ...identities];
    const result = createGame(
      {
        seed: 1,
        cards,
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [PLAIN_MINION.id, UNIQUE_MINION.id],
        includeIdentitySets: false,
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = runCommands(result.state, deps).state;
    const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };

    const plainId = Object.entries(state.instances).find(([, i]) => i.cardId === PLAIN_MINION.id)?.[0] as InstanceId;
    const uniqueId = Object.entries(state.instances).find(([, i]) => i.cardId === UNIQUE_MINION.id)?.[0] as
      | InstanceId
      | undefined;
    if (!uniqueId) throw new Error("expected an instance of the unique minion");
    const identityId = state.players[0]?.identity.instanceId as InstanceId;

    expect(matchesQuery(state, plainId, { categories: ["minion"], unique: false }, context)).toBe(true);
    expect(explainQuery(state, plainId, { categories: ["minion"], unique: true }, context)).toBe("wrongUnique");
    expect(matchesQuery(state, uniqueId, { categories: ["minion"], unique: true }, context)).toBe(true);
    expect(matchesQuery(state, identityId, { categories: ["identity"], unique: true }, context)).toBe(true);
  });
});
