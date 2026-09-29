/**
 * docs/phase7-wave5.md §4.1 Q63: `resolveSpecials.abilities` resolves only the Special(s) it names. Synthetic cards
 * shaped like Spider-Man (Miles Morales, `sm` 27030a), which prints two Specials ("Venom Blast", "Spider Camouflage"),
 * and Web-Shot (27034): "resolve Spider-Man's 'Venom Blast' ability" — one Special, not both. Without `abilities`,
 * every Special on the card resolves, as before (Wakanda Forever!, Invocation cards, single-Special cards).
 */

import type { AbilityId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubEvent } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const gizmo: TargetRef = { kind: "named", name: "gizmo" };

const special = (id: string, counterType: string) =>
  stubAbility(id, {
    trigger: { kind: "special" },
    effects: [{ kind: "addCounters", target: { kind: "self" }, counterType, amount: { kind: "const", value: 1 } }],
  });
const BLAST = special("gizmo.blast-special", "blast");
const CAMO = special("gizmo.camo-special", "camo");
const GIZMO = stubEnvironment({ id: "gizmo", abilities: [BLAST.ref, CAMO.ref] });

const event = (id: string, abilities?: readonly AbilityId[]) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "resolveSpecials", of: gizmo, ...(abilities ? { abilities } : {}) }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ONLY_BLAST = event("only-blast", [BLAST.ref.id]);
const ONLY_CAMO = event("only-camo", [CAMO.ref.id]);
const EVERY = event("every");

const deps: EngineDeps = depsOf(BLAST, CAMO, ONLY_BLAST.ability, ONLY_CAMO.ability, EVERY.ability);

function start(): { readonly state: GameState; readonly gizmoId: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [GIZMO, ONLY_BLAST.card, ONLY_CAMO.card, EVERY.card],
    deps,
    encounter: [GIZMO.id],
    deck: [ONLY_BLAST.card.id, ONLY_CAMO.card.id, EVERY.card.id],
  });
  const inPlay = encounterCardInVillainArea(state, GIZMO.id);
  return { state: inPlay.state, gizmoId: inPlay.id };
}

const countersOn = (state: GameState, id: InstanceId) => {
  const { counters } = mustInstance(state, id);
  return { blast: counters.blast ?? 0, camo: counters.camo ?? 0 };
};

describe("§4.1 Q63 'resolve Spider-Man's 'Venom Blast' ability'", () => {
  it("naming one Special resolves it alone; replay deep-equal", () => {
    const { state, gizmoId } = start();
    const played = playFree(state, deps, ONLY_BLAST.card.id);
    expect(countersOn(played.state, gizmoId)).toEqual({ blast: 1, camo: 0 });
    const replayed = replay(played.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(played.session.state);
  });

  it("naming the other Special resolves only that one", () => {
    const { state, gizmoId } = start();
    expect(countersOn(playFree(state, deps, ONLY_CAMO.card.id).state, gizmoId)).toEqual({ blast: 0, camo: 1 });
  });

  it("no filter resolves every Special on the card, as before; replay deep-equal", () => {
    const { state, gizmoId } = start();
    const played = playFree(state, deps, EVERY.card.id);
    expect(countersOn(played.state, gizmoId)).toEqual({ blast: 1, camo: 1 });
    const replayed = replay(played.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(played.session.state);
  });
});
