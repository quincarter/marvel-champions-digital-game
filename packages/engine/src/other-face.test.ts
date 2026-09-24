/**
 * docs/phase7-wave4.md §3.10: flipping a card into a separately emitted face (`otherFaceId`, §1.7). Synthetic cards
 * shaped like the MTS campaign side schemes (`mts` 21180a/b Secure the Landing Pad → Cosmo, "Hinder 1[per_hero]. When
 * Defeated: Flip this card over." / "The first player gains control of Cosmo."; 21182a/b Save the Shawarma Place →
 * Black Swan, "Black Swan engages the first player."; 21184a/b Hack Sanctuary's Computer → Defensive Protocols, "Hinder
 * 2. Victory 2.").
 *
 * Sources: the cards' own text; RRG 1.8 "Flip" (p. 20: a different card type discards "all attached cards, tucked
 * cards, status cards, and tokens"; the same type keeps them), "When Defeated Abilities" (p. 48: "A defeated card leaves
 * play after its 'When Defeated' ability is resolved"), "Double-Sided Card" (p. 17); §4 Q17, user decision 2026-09-24 (the new face is treated as
 * entering play).
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const FLIP = stubAbility("flip-over.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "flipCard", target: self }],
});
const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const [LANDING, COSMO] = faces(
  stubSideScheme({ id: "landing-pad", startingThreat: 3, abilities: [FLIP.ref] }),
  stubAlly({ id: "cosmo", cost: 0, atk: 2, thw: 2, hp: 3 }),
);
const [SHAWARMA, SWAN] = faces(
  stubSideScheme({ id: "shawarma", startingThreat: 2, abilities: [FLIP.ref] }),
  stubMinion({ id: "black-swan", atk: 2, sch: 1, hp: 4 }),
);
const [HACK, PROTOCOLS] = faces(
  stubSideScheme({ id: "hack", startingThreat: 2, abilities: [FLIP.ref] }),
  stubSideScheme({ id: "protocols", startingThreat: 2, keywords: [{ name: "hinder", value: 2 }] }),
);
const FACES = [LANDING, COSMO, SHAWARMA, SWAN, HACK, PROTOCOLS];

const eachSideScheme: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const MARK = event("mark", [
  { kind: "addCounters", target: eachSideScheme, counterType: "mark", amount: { kind: "const", value: 1 } },
]);
const THWART = event("thwart", [{ kind: "removeThreat", target: eachSideScheme, amount: { kind: "const", value: 9 } }]);
const EVENTS = [REVEAL, MARK, THWART];
const deps: EngineDeps = depsOf(FLIP, ...EVENTS.map((e) => e.ability));

/** The side scheme revealed, marked with a counter, then thwarted to 0. */
function defeat(scheme: AnyCard): { before: GameState; after: GameState; id: InstanceId; session: unknown } {
  const base = gameAtFirstTurn({
    cards: [...FACES, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [LANDING.id, SHAWARMA.id, HACK.id, ...copiesOf(TREACHERY.id, 10)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  const revealed = playFree(onTopOfEncounterDeck(base, scheme.id), deps, REVEAL.card.id).state;
  const marked = playFree(revealed, deps, MARK.card.id).state;
  const id = Object.values(marked.instances).find((i) => i.cardId === scheme.id)!.instanceId;
  const { state, session } = playFree(marked, deps, THWART.card.id);
  return { before: marked, after: state, id, session };
}

describe("§3.10 flipping into a separately emitted face", () => {
  it("a side scheme that flips into an ally on its When Defeated stays in play, as the first player's ally, bare", () => {
    const { before, after, id, session } = defeat(LANDING);
    expect(mustInstance(before, id).counters["mark"]).toBe(1);
    const cosmo = mustInstance(after, id);
    expect(cosmo.cardId).toBe(COSMO.id);
    expect(locateCard(after, id)).toEqual({ kind: "playArea", playerId: P1 });
    expect(cosmo.controllerId).toBe(P1);
    expect(cosmo.counters).toEqual({});
    expect(cosmo.threat).toBe(0);
    expect(after.villainArea).not.toContain(id);
    const log = (session as { log: Parameters<typeof replay>[0] }).log;
    const replayed = replay(log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual((session as { state: GameState }).state);
  });

  it("one that flips into a minion is engaged with the first player", () => {
    const { after, id } = defeat(SHAWARMA);
    expect(mustInstance(after, id).cardId).toBe(SWAN.id);
    expect(locateCard(after, id)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(after, id).engagedWith).toBe(P1);
  });

  it("one that flips into another side scheme keeps its tokens and enters with its starting threat and hinder", () => {
    const { after, id } = defeat(HACK);
    const protocols = mustInstance(after, id);
    expect(protocols.cardId).toBe(PROTOCOLS.id);
    expect(locateCard(after, id)).toEqual({ kind: "villainArea" });
    expect(protocols.counters["mark"]).toBe(1);
    expect(protocols.threat).toBe(4);
  });
});
