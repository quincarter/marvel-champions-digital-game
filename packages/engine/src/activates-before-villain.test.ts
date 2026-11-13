/**
 * `RuleSpec activatesBeforeVillain`: "During step 2 of the villain phase, Barracuda activates against you before The
 * Punisher does." (The Punisher community scenario). RRG 1.8 "Villain Phase" (p. 47) step 2: for each player in order,
 * the villain activates against them (2a), then each minion engaged with them, in their order (2b). A minion under the
 * rule moves ahead of 2a for its engaged player; every other minion keeps its place after the villain, and each
 * activates once.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMinion } from "./testing/fixtures.js";
import { runCommandsPicking } from "./testing/drive.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const EARLY_CONSTANT = stubAbility("early.constant", {
  trigger: { kind: "constant", rules: [{ kind: "activatesBeforeVillain", target: { self: true } }] },
  effects: [],
});
const EARLY = stubMinion({ id: "early", atk: 1, sch: 1, hp: 9, abilities: [EARLY_CONSTANT.ref] });
const EARLY_TOO = stubMinion({ id: "early-too", atk: 1, sch: 1, hp: 9, abilities: [EARLY_CONSTANT.ref] });
const LATE = stubMinion({ id: "late", atk: 1, sch: 1, hp: 9 });
const MINIONS = [EARLY, EARLY_TOO, LATE];

const deps: EngineDeps = depsOf(EARLY_CONSTANT);

function table(
  engaged: readonly (readonly [string, typeof P1])[],
  players: 1 | 2 = 1,
): { readonly state: GameState; readonly ids: Readonly<Record<string, InstanceId>> } {
  const base = gameAtFirstTurn({
    cards: MINIONS,
    deps,
    players,
    encounter: [...MINIONS.map((m) => m.id), ...copiesOf(LATE.id, 2), ...copiesOf("treachery" as never, 20)],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ids: Record<string, InstanceId> = {};
  for (const [minion, player] of engaged) {
    const placed = minionEngagedWith(state, minion as never, player);
    state = placed.state;
    ids[minion] = placed.id;
  }
  return { state, ids };
}

/** Every seat ends its turn; the villain phase plays with `pick` answering its prompts. */
function villainPhase(state: GameState, pick: (s: GameState) => readonly string[] = defaultPick) {
  const ends = state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId }));
  return runCommandsPicking(state, deps, pick, ...ends);
}

const attackOrder = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "attackResolved" ? [e.enemyInstanceId] : []));
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

describe("RuleSpec activatesBeforeVillain (RRG 1.8 'Villain Phase', p. 47, step 2)", () => {
  it("control: without the rule the villain activates first, then the minion", () => {
    const t = table([["late", P1]]);
    const { events } = villainPhase(t.state);
    expect(attackOrder(events)).toEqual([villainOf(t.state), t.ids.late]);
  });

  it("a minion under the rule activates against its player before the villain, the others after it", () => {
    const t = table([
      ["late", P1],
      ["early", P1],
    ]);
    const { events } = villainPhase(t.state);
    expect(attackOrder(events)).toEqual([t.ids.early, villainOf(t.state), t.ids.late]);
  });

  it("two such minions go in the engaged player's order, both before the villain", () => {
    const t = table([
      ["early", P1],
      ["early-too", P1],
    ]);
    const asked: (readonly string[])[] = [];
    // Pick the second option offered, so the order is the player's and not the play area's.
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseMinionToActivate") return defaultPick(s);
      asked.push(choice.options.map((o) => o.optionId));
      return [choice.options[choice.options.length - 1]!.optionId];
    };
    const { events } = villainPhase(t.state, pick);
    expect(asked[0], "both early minions, and only they, before the villain").toEqual([
      t.ids.early,
      t.ids["early-too"],
    ]);
    expect(attackOrder(events)).toEqual([t.ids["early-too"], t.ids.early, villainOf(t.state)]);
  });

  it("it activates before the villain's activation against its own engaged player, in player order", () => {
    const t = table(
      [
        ["late", P1],
        ["early", P2],
      ],
      2,
    );
    const { events } = villainPhase(t.state);
    const villain = villainOf(t.state);
    expect(attackOrder(events)).toEqual([villain, t.ids.late, t.ids.early, villain]);
  });
});
