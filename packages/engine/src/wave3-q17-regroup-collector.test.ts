/**
 * rules-qa-engineer pin for docs/phase7-wave3.md §4 Q17 (open question, undecided by FFG): "Regroup and the
 * Collector's discard redirect on the same ally." Regroup (`drax` 19032, an optional Interrupt: "When an ally is
 * defeated by an enemy attack, return it to its owner's hand instead of discarding it") and Collector I–III (a
 * Forced Interrupt, `discardFromPlayDestination`, docs/phase7-wave3.md §3.14: "When a card … would be placed into
 * a discard pile from play, put it faceup into The Collection instead") both replace the discard of the same
 * defeated ally, and there is no ruling that says which wins when both are live at once.
 *
 * This test does not decide the question (not this agent's call — see CLAUDE.md's rules-qa-engineer boundary). It
 * pins **today's engine behavior**: Regroup's own interrupt (`setDefeatDestination`, resolved in the defeat's own
 * interrupt window) wins, because the engine models the Collector's redirect as a constant rule applied later, at
 * the moment the card actually leaves play (`discardFromPlayDestination`, read in `leavePlay`) — not as a second
 * interrupt racing Regroup's in the same window. So the ally ends up in its owner's hand, not in The Collection.
 * RRG 1.8 Appendix III ("Simultaneous Timing Priority") would resolve a forced interrupt before an optional one if
 * both answered the *same* triggering event — the reading docs/phase7-wave3.md §3.45's own docblock flags as the
 * one an FFG answer could reasonably overturn. If a future ruling instead has the Collector win, this is the one
 * test that should flip.
 *
 * Reuses `defeat-destination.test.ts`'s and `scenario-area.test.ts`'s own stub shapes (Regroup, Collector) rather
 * than inventing new ones, so this test only differs from those two files in combining both cards on the same
 * defeated ally at once — exactly the situation neither of those two files' own tests puts them in.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const AREA = "The Collection";

const REGROUP_INTERRUPT = stubAbility("regroup.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: {
      on: "characterDefeated",
      targetIs: { categories: ["ally"] },
      sourceIs: { categories: ["enemy"] },
      fromAttack: true,
    },
  },
  effects: [{ kind: "setDefeatDestination", to: "hand" }],
});
const REGROUP = stubSupport({ id: "regroup", cost: 0, abilities: [REGROUP_INTERRUPT.ref] });

const COLLECTOR_RULE = stubAbility("collector.constant", {
  trigger: { kind: "constant", rules: [{ kind: "discardFromPlayDestination", cards: {}, area: AREA }] },
  effects: [],
});
const COLLECTOR = stubVillain({
  id: "collector",
  stages: [{ hp: flat(40), atk: 5, sch: 1, abilities: [COLLECTOR_RULE.ref] }],
});

const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 3, thw: 1, hp: 2 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(REGROUP_INTERRUPT, COLLECTOR_RULE);
const CARDS = [REGROUP, RECRUIT, BLANK];
const DECK: readonly CardId[] = [REGROUP.id, RECRUIT.id];
const ENCOUNTER: readonly CardId[] = [...copiesOf(BLANK.id, 12)];

function table(): { state: GameState; recruit: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, encounter: ENCOUNTER, villain: COLLECTOR });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const regroup = playerCardIntoPlay(hero, REGROUP.id);
  const recruit = playerCardIntoPlay(regroup.state, RECRUIT.id);
  return { state: recruit.state, recruit: recruit.id };
}

const picker =
  (ally: InstanceId) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") {
      const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally);
      return defend ? [defend.optionId] : ["decline"];
    }
    // Accept every optional/forced interrupt/response offered (both Regroup and the Collector, when both apply).
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    return defaultPick(state);
  };

describe("§4 Q17: Regroup vs. the Collector's discard redirect on the same defeated ally", () => {
  it("today's engine: Regroup's own interrupt wins — the ally returns to hand, not The Collection", () => {
    const t = table();
    const endTurn: Command = { type: "endTurn", playerId: P1 };
    const { state, events } = runCommandsPicking(t.state, deps, picker(t.recruit), endTurn);
    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === t.recruit)).toBe(true);
    expect(mustPlayer(state, P1).hand).toContain(t.recruit);
    expect(state.scenarioAreas?.[AREA] ?? []).not.toContain(t.recruit);
  });
});
