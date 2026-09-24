/**
 * `ValueSpec mainSchemeStageNumber` (docs/phase7-wave3.md's `gmw`/Escape the Museum scripting pass): "X is equal to
 * the main scheme's current stage number" (Collector I/II, `gmw` 16080a/16081a, "[Collector] gets +X SCH and +X
 * ATK…"). The `villainStageNumber` sibling (`select.ts`) already reads a villain's own printed stage number the same
 * way; this is the main-scheme analog, generic and card-name-free.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { playerId } from "./ids.js";
import { resolveValue, type EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";

const p1 = playerId("p1");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

/** Three stages, so advancing twice (stage 1 -> 2 -> 3) is observable through the value. */
const THREE_STAGE_SCHEME = stubMainScheme({
  id: "three-stage",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) },
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) },
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) },
  ],
});

/** "Action: advance the main scheme to the next stage" — a synthetic event, so the test drives a real command. */
const ADVANCE = stubAbility("advance.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "advanceMainScheme" }],
});
const ADVANCE_CARD = stubEvent({ id: "advance-card", cost: 0, abilities: [ADVANCE.ref] });

const ABILITIES: readonly StubAbility[] = [ADVANCE];
const deps: EngineDeps = depsOf(...ABILITIES);
const CARDS = [QUIET_VILLAIN, THREE_STAGE_SCHEME, BLANK, ADVANCE_CARD];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed: 5,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: THREE_STAGE_SCHEME.id,
    encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
    includeIdentitySets: false,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: [ADVANCE_CARD.id, ADVANCE_CARD.id] })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const context = (_state: GameState): EffectContext => ({
  selfInstanceId: null,
  controllerId: p1,
  event: null,
  bindings: {},
  deps,
});

function playAdvanceCard(state: GameState) {
  const given = giveCard(state, p1, ADVANCE_CARD.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
}

describe("mainSchemeStageNumber", () => {
  it("reads the central main scheme's current printed stage number, and follows an advance", () => {
    const stage1 = game();
    expect(resolveValue(stage1, { kind: "mainSchemeStageNumber" }, context(stage1))).toBe(1);

    const stage2 = playAdvanceCard(stage1);
    expect(resolveValue(stage2, { kind: "mainSchemeStageNumber" }, context(stage2))).toBe(2);

    const stage3 = playAdvanceCard(stage2);
    expect(resolveValue(stage3, { kind: "mainSchemeStageNumber" }, context(stage3))).toBe(3);
  });
});
