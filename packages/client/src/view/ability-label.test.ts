/**
 * `abilityLabelOf`, checked against a real Core game and the real Core
 * ability registry — nothing here is a hand-rolled fixture standing in for
 * content, because the whole point is that this never invents wording.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { abilityId } from "@mc/content";
import type { AbilityDefinition, GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { abilityLabelOf, abilityShortLabelOf } from "./ability-label.js";
import { cardName } from "./names.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 12,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;
let identityId: InstanceId;

beforeAll(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  state = store.state.game!;
  me = store.state.perspectiveId!;
  identityId = state.players.find((player) => player.playerId === me)!.identity.instanceId;
});

describe("abilityLabelOf", () => {
  test("prefers the printed sub-ability name when the card has one", () => {
    const player = state.players.find((p) => p.playerId === me)!;
    // Spider-Man's identity names both faces' signature abilities — pick
    // whichever face the game actually started in, so the test doesn't
    // depend on which side Setup left the player on.
    const heroAbilityId =
      player.identity.form === "hero" ? abilityId("01001a.spider-sense") : abilityId("01001b.scientist");
    const printed = player.identity.form === "hero" ? "Spider-Sense" : "Scientist";
    const label = abilityLabelOf(state, identityId, heroAbilityId, CORE_DEPS);
    expect(label).toBe(`${cardName(state, identityId)} — ${printed}`);
  });

  test("falls back to the card's name alone when there is neither a printed label nor a cost", () => {
    const deps = { abilities: { "test.bare": { trigger: { kind: "action" }, effects: [] } as AbilityDefinition } };
    expect(abilityLabelOf(state, identityId, abilityId("test.bare"), deps)).toBe(cardName(state, identityId));
  });

  test('names a Special ability "Special" — the RRG\'s own term, never printed on the AbilityReference itself', () => {
    const deps = { abilities: { "test.special": { trigger: { kind: "special" }, effects: [] } as AbilityDefinition } };
    expect(abilityLabelOf(state, identityId, abilityId("test.special"), deps)).toBe(
      `${cardName(state, identityId)} — Special`,
    );
  });

  // The next three use the real `AbilityCost` shapes from `CORE_DEPS` for the
  // three action abilities that actually reach `useAbility` in a real Rhino
  // game (found by scanning `legalActions` across three full games — none of
  // Core's `AbilityReference.label`s belong to an action ability, so this
  // fallback path is what every real case takes). They're paired with the
  // identity's own instance rather than the owning card's, since driving the
  // game to get Aunt May/Surveillance Team/Tenacity into a visible zone would
  // test `cardName` (already covered in `names.test.ts`) rather than the cost
  // phrasing this test is about; only the " — …" suffix is real Aunt May /
  // Surveillance Team / Tenacity data.

  test("describes an exhaust cost in the engine's own terms (Aunt May)", () => {
    // "Alter-Ego Action: Exhaust Aunt May → heal 4 damage from Peter Parker."
    const label = abilityLabelOf(state, identityId, abilityId("01006.aunt-may-action"), CORE_DEPS);
    expect(label).toBe(`${cardName(state, identityId)} — exhaust`);
  });

  test("describes a counter-spending cost (Surveillance Team)", () => {
    // "Action: Exhaust Surveillance Team and remove 1 snoop counter from it → …"
    const label = abilityLabelOf(state, identityId, abilityId("01064.surveillance-team-action"), CORE_DEPS);
    expect(label).toBe(`${cardName(state, identityId)} — exhaust, remove 1 snoop counter`);
  });

  test("describes a resources-plus-discard cost (Tenacity)", () => {
    // "Action: Spend 1 [physical] resource and discard Tenacity → ready your hero."
    const label = abilityLabelOf(state, identityId, abilityId("01093.tenacity-action"), CORE_DEPS);
    expect(label).toBe(`${cardName(state, identityId)} — spend 1 physical, discard this card`);
  });

  /**
   * The affordance is drawn on the card itself, where the name is already
   * printed. Repeating it pushed the cost off the end of the line, which is the
   * only part the table doesn't already show.
   */
  test("the on-card label drops the card's own name and keeps the cost", () => {
    const id = abilityId("01064.surveillance-team-action");
    const name = cardName(state, identityId);
    const full = abilityLabelOf(state, identityId, id, CORE_DEPS);
    const short = abilityShortLabelOf(state, identityId, id, CORE_DEPS);

    expect(short).toBe("exhaust, remove 1 snoop counter");
    expect(short).not.toContain(name);
    expect(full).toBe(`${name} — ${short}`);
  });
});
