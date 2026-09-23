/**
 * `resolveSpecials` inherits the calling ability's controller when the resolved card has none of its own
 * (`executeResolveSpecials`, `resolve/effects-frame.ts`). Found scripting Nebula's Technique attachments (`gmw`
 * 16094-16098): a Special ability's own "you" ("You are stunned.", "Take 1 damage.") resolved to `null` (no
 * player) when instructed by a villain's own Forced Interrupt (`resolveSpecials({ cards })`), because the
 * attachment itself — attached to the villain, an encounter card — has no controller of its own. RRG 1.8 "You,
 * Your" (p. 49): when a card has no controller, "you" is whoever the ability text concerns; here, that is the
 * player the *instructing* ability was already resolving for.
 *
 * `resolveSpecials({ of })` (a specific card, a Boost ability's own "attach this card and resolve its Special")
 * already worked, because a Boost ability frame's own controller is the activation's player — this fix only
 * changes the `{ cards }` (query) path used by a Forced Interrupt/Response resolving another card's Special.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetRef } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubVillain } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };

const GADGET_SPECIAL = stubAbility("gadget.special", {
  trigger: { kind: "special" },
  effects: [{ kind: "dealDamage", target: yourIdentity, amount: { kind: "const", value: 1 } }],
});
const GADGET = stubAttachment({
  id: "gadget",
  attachesTo: { kind: "villain" },
  abilities: [GADGET_SPECIAL.ref],
});
const RESOLVE_SPECIAL = stubAbility("villain.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", selfIs: "source" } },
  effects: [{ kind: "resolveSpecials", cards: { name: "gadget" } }],
});
const VILLAIN = stubVillain({
  id: "villain",
  stages: [{ hp: flat(20), atk: 1, sch: 1, abilities: [RESOLVE_SPECIAL.ref] }],
});

const deps: EngineDeps = depsOf(RESOLVE_SPECIAL, GADGET_SPECIAL);

describe("resolveSpecials inherits the calling ability's controller", () => {
  it("a Special ability's 'you', resolved via a villain's own Forced Interrupt, is the villain-phase player, not null", () => {
    const base = gameAtFirstTurn({ cards: [GADGET], deps, villain: VILLAIN, encounter: [GADGET.id] });
    const attached = encounterCardInVillainArea(base, GADGET.id);
    const identity = mustPlayer(attached.state, P1).identity.instanceId;
    const damageBefore = mustInstance(attached.state, identity).damage;
    // p1 starts in alter-ego form, so the villain's own villain-phase activation is a scheme (`enemyScheme`).
    const { state: after } = runCommands(attached.state, deps, { type: "endTurn", playerId: P1 });
    expect(mustInstance(after, identity).damage).toBeGreaterThan(damageBefore);
  });
});
