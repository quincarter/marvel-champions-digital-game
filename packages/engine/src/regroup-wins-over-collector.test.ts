/**
 * docs/phase7-wave3.md §4 Q17, decided by the user on 2026-09-23 (no FFG ruling): **Regroup wins over the Collector's
 * discard redirect, and the ally goes to its owner's hand.** Regroup (`drax` 19032, an optional Interrupt: "When an
 * ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it") and Collector I–III
 * (a Forced Interrupt, `discardFromPlayDestination`, docs/phase7-wave3.md §3.14: "When a card … would be placed into
 * a discard pile from play, put it faceup into The Collection instead") both reach the discard of the same defeated
 * ally.
 *
 * The user's reasoning: Regroup triggers on the defeat, which comes before the card would ever be placed in a discard
 * pile, so once Regroup has resolved the Collector never triggers. RRG 1.8 Appendix III's forced-before-optional
 * order applies only to abilities answering the *same* triggering condition, which these two do not. The engine
 * already models it that way: Regroup's `setDefeatDestination` resolves in the defeat's own interrupt window, and the
 * Collector's redirect is a constant read only when a card actually goes to a discard pile from play (`leavePlay`).
 * No engine change was needed; this file was the rules-QA pin `wave3-q17-regroup-collector.test.ts` while Q17 was
 * open.
 *
 * Reuses `defeat-destination.test.ts`'s and `scenario-area.test.ts`'s own stub shapes (Regroup, Collector), combined
 * on the same defeated ally, which neither of those files does.
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

describe("§4 Q17 (decided 2026-09-23): Regroup wins over the Collector's discard redirect on the same defeated ally", () => {
  it("Regroup triggers on the defeat, before any discard: the ally returns to hand, and the Collector never triggers", () => {
    const t = table();
    const endTurn: Command = { type: "endTurn", playerId: P1 };
    const { state, events } = runCommandsPicking(t.state, deps, picker(t.recruit), endTurn);
    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === t.recruit)).toBe(true);
    expect(mustPlayer(state, P1).hand).toContain(t.recruit);
    expect(state.scenarioAreas?.[AREA] ?? []).not.toContain(t.recruit);
    // The Collector's redirect never happened for it.
    expect(
      events.some(
        (e) => e.type === "triggerEvent" && e.event.kind === "discardRedirected" && e.event.instanceId === t.recruit,
      ),
    ).toBe(false);
  });
});
