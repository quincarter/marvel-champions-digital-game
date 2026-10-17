/**
 * Rules audit chunk 11 (Glossary: MOVE ... PIERCING). Audit proofs only: each `it.fails` marks a place the scripts do
 * something the sources do not allow, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Move" (Glossary): "When an element moves, it cannot move to its same (current) placement."
 * FFG ruling (post-RRG 1.5, answered by Alex; Hall of Heroes "Latest FFG Rulings (post RRG 1.5)", Q38 "Check my
 * understanding of 'move'"): when the main scheme holding the glider counter is tied for the least threat with another
 * main scheme, "you must move the glider counter to the other scheme". The script (`wave5/sm/venom-goblin/main-scheme.ts`
 * `moveToLeastThreatScheme`) offers every tied scheme, the current one included, so the first player may leave it.
 * (The existing test "a tie for least threat is broken by the first player's own choice" picks the current scheme and
 * expects the glider to stay.)
 *
 * RRG 1.8 "Permanent" (p. 32): "Permanent cards are not valid targets for card effects that would cause the permanent
 * card to leave play. If a permanent card would be targeted by such an effect (for example, "discard the lowest-cost
 * support you control"), that effect instead targets the non-permanent card that fits its criteria." Beetle (hood
 * 24043) "After Beetle attacks and damages you, discard the lowest-cost upgrade you control" is scripted
 * (`wave4/hood/sinister-syndicate.ts`) as a `superlative` over every upgrade you control, then a pick from that slot:
 * Wolverine's Claws (35002, Permanent, cost 0) is the lowest, the discard is stopped, and the choice "found nothing".
 */
import { cardId, encounterSetId } from "@mc/content";
import { activeEncounterDeck, currentName, getInstance, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, inst, P1, patchInstance, picking, playerOf } from "../testing/harness.js";
import { drive, intoPlay, rhino } from "../testing/qa-bench.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";
import { ghostSpiderScenario } from "../wave5/sm/ghost-spider/support.js";

const schemes = (state: GameState): readonly InstanceId[] => [
  state.mainScheme.instanceId,
  ...(state.extraMainSchemes ?? []).map((s) => s.instanceId),
];
const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = schemes(state).find((id) => currentName(state, id) === name);
  if (!found) throw new Error(`no main scheme named ${name}`);
  return found;
};
const gliderOn = (state: GameState): string | undefined =>
  schemes(state)
    .filter((id) => (getInstance(state, id)?.counters["glider"] ?? 0) > 0)
    .map((id) => currentName(state, id))[0];
function gliderTo(state: GameState, name: string): GameState {
  let next = state;
  for (const id of schemes(state)) {
    const counters = { ...inst(next, id).counters };
    delete counters["glider"];
    next = patchInstance(next, id, { counters });
  }
  const target = schemeNamed(next, name);
  return patchInstance(next, target, { counters: { ...inst(next, target).counters, glider: 1 } });
}

describe("audit 11.1 MOVE: the glider counter cannot stay where it is when another scheme is tied for least threat", () => {
  it("glider on Upper, tied with Lower for least threat: the first player cannot keep it on Upper", () => {
    let base = startWave5Game(
      ghostSpiderScenario("venom-goblin", { seed: 11, modularSetIds: [encounterSetId("bomb_scare")] }),
    );
    base = withForm(base, { heroForm: 0 }, P1);
    base = gliderTo(base, "Upper Manhattan");
    base = patchInstance(base, schemeNamed(base, "Lower Manhattan"), { threat: 0 });
    base = patchInstance(base, schemeNamed(base, "Midtown Manhattan"), { threat: 1 });
    base = patchInstance(base, schemeNamed(base, "Upper Manhattan"), { threat: 0 });
    const upper = schemeNamed(base, "Upper Manhattan");
    const { state } = driveEventsPicking(WAVE5_DEPS, base, picking(upper, "1"), endTurn(P1));
    expect(gliderOn(state)).toBe("Lower Manhattan");
  });
});

/** Beetle (24043) engaged with P1, relabelled from the top encounter card and taken out of the deck. */
function beetleEngaged(state: GameState): GameState {
  const spare = activeEncounterDeck(state).deck[0]!;
  const relabelled = patchInstance(state, spare, { cardId: cardId("24043") });
  const s: GameState = {
    ...relabelled,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([k, v]) => [k, { ...v, deck: v.deck.filter((i) => i !== spare) }]),
    ),
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { ...s, instances: { ...s.instances, [spare]: { ...s.instances[spare]!, faceup: true, engagedWith: P1 } } };
}

describe("audit 11.14 PERMANENT: 'the lowest-cost upgrade you control' targets the non-permanent upgrade", () => {
  it.fails("Claws (cost 0, Permanent) and Spider-Tracer (cost 1): Beetle's discard takes the Spider-Tracer", () => {
    let s = beetleEngaged(rhino());
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
    const claws = intoPlay(s, "35002", {}, 2);
    const tracer = intoPlay(claws.state, "01007", {}, 3);
    const done = drive(tracer.state, endTurn(P1));
    // Beetle's forced response resolved (it attacked and damaged P1) ...
    expect(
      done.events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === "24043.beetle-forced-response"),
    ).toBe(true);
    // ... Claws cannot leave play, so the Spider-Tracer is the card that fits the criteria.
    expect(playerOf(done.state, P1).playArea).toContain(claws.id);
    expect(playerOf(done.state, P1).discard).toContain(tracer.id);
  });
});
