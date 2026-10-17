/**
 * Rules audit chunk 11 (Glossary: MOVE ... PIERCING), engine-level proofs. Each `it.fails` marks a place the engine does
 * something the RRG 1.8 does not allow, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Permanent" (p. 32): "If the card to which a permanent attachment was attached leaves play, resolve that
 * attachment's "attach to" text. If it has none or that text does not have a valid target, remove the attachment from
 * the game." The engine instead leaves the permanent attachment in its controller's play area, unattached
 * (`effects.ts` `strandedAttachmentsOf`; `stranded-attachment-former-host.test.ts` › "a permanent attachment with no such
 * ability stays in its controller's play area, as before"). A permanent upgrade has no "attach to" text, so it must be
 * removed from the game when its host is defeated.
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import { mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubEvent, stubMinion, stubUpgrade } from "../testing/fixtures.js";
import { TREACHERY } from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "../testing/wave3.js";
import type { EffectSpec, TargetRef } from "../spec.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const BADGE = stubUpgrade({ id: "badge", cost: 0, keywords: [{ name: "permanent" }] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ATTACH = event("attach-badge-thug", [{ kind: "attach", card: named("badge"), to: named("thug") }]);
const DEFEAT = event("defeat-thug", [{ kind: "defeat", target: named("thug") }]);
const deps: EngineDeps = depsOf(ATTACH.ability, DEFEAT.ability);

describe("audit 11.14 PERMANENT: a permanent attachment whose host leaves play, with no 'attach to' text, is removed from the game", () => {
  it.fails("a permanent upgrade attached to a minion that is then defeated is removed from the game", () => {
    const base = gameAtFirstTurn({
      cards: [BADGE, THUG, ATTACH.card, DEFEAT.card],
      deps,
      encounter: [...copiesOf(TREACHERY.id, 28), THUG.id],
      deck: [BADGE.id, ATTACH.card.id, DEFEAT.card.id],
    });
    const badge = playerCardIntoPlay(base, BADGE.id);
    const thug = minionEngagedWith(badge.state, THUG.id);
    let state: GameState = thug.state;
    state = playFree(state, deps, ATTACH.card.id).state;
    expect(state.instances[badge.id as InstanceId]?.attachedTo).toBe(thug.id);
    state = playFree(state, deps, DEFEAT.card.id).state;
    expect(mustPlayer(state, P1).playArea).not.toContain(thug.id);
    // The card must be out of play and removed from the game, not left loose in the play area.
    expect(mustPlayer(state, P1).playArea).not.toContain(badge.id);
    expect(state.removedFromGame).toContain(badge.id);
  });
});
