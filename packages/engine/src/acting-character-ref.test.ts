/**
 * `TargetRef actingCharacter` (RRG 1.8 "You, Your", p. 49): the character a card acts for. A minion that is defeated
 * by an event card names the event's player's identity as "the character that defeated it".
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree } from "./testing/wave3.js";
import { mustPlayer, mustInstance } from "./query.js";

const eventSource: TargetRef = { kind: "eventSource" };
const acting: TargetRef = { kind: "actingCharacter", of: eventSource };
const stunActing: EffectSpec = { kind: "giveStatus", target: acting, status: "stunned" };

const DEFEATED = stubAbility("goon.when-defeated", { trigger: { kind: "whenDefeated" }, effects: [stunActing] });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3, abilities: [DEFEATED.ref] });
const SMASH_ABILITY = stubAbility("smash.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "const", value: 9 },
    },
  ],
});
const SMASH = stubEvent({ id: "smash", cost: 0, abilities: [SMASH_ABILITY.ref] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(DEFEATED, SMASH_ABILITY);

describe("TargetRef actingCharacter", () => {
  it("a minion defeated by an event card: the event's player's identity is the character that defeated it", () => {
    const start = gameAtFirstTurn({
      cards: [GOON, SMASH, NOISE],
      deps,
      encounter: [GOON.id, ...copiesOf(NOISE.id, 14)],
      deck: copiesOf(SMASH.id, 6),
    });
    const goon = minionEngagedWith(start, GOON.id);
    const run = playFree(goon.state, deps, SMASH.id, P1);
    const identity = mustPlayer(run.state, P1).identity.instanceId;
    expect(mustInstance(run.state, identity).statuses.stunned).toBe(1);
    expect(mustInstance(run.state, goon.id).statuses.stunned).toBe(0);
  });
});
