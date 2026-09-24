/**
 * The either/or branch and "up to N counters" prompt, against a real cycle 2 game.
 *
 * The Grand Collection 1B (`gmw` 16073b), Infiltrate the Museum's own main scheme stage, prints its either/or cost
 * ("Choose to either exhaust your hero or spend 2 resources of any type →") and is live from turn one: its Setup
 * already put a card from each player's deck into The Collection (`packages/cards/src/wave3/gmw/museum.ts`), so
 * both branches are legal without any further setup.
 */

import { beforeEach, describe, expect, test } from "vitest";
import type { AbilityId } from "@mc/content";
import type { GameState, LegalAction, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { POOL_DEPS } from "../content/pool.js";
import { costChoicePromptFor } from "./cost-choice-model.js";

const ROCKET_VS_BADOON: SessionConfig = {
  scenarioId: "infiltrate-the-museum",
  difficulty: "standard",
  players: [{ starterDeckId: "rocket-raccoon-aggression" }],
  seed: 3,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

async function intoTurn(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(ROCKET_VS_BADOON);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
}

function grandCollectionAction(): LegalAction {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find(
    (candidate) =>
      candidate.action.kind === "useAbility" && candidate.action.abilityId === "16073b.the-grand-collection-action",
  );
  if (!entry) throw new Error("expected The Grand Collection's either/or action to be legal turn one");
  return entry;
}

describe("cost-choice mode: an either/or branch (The Grand Collection)", () => {
  beforeEach(intoTurn);

  test("both branches are offered, each with its own plain-language label", () => {
    void me;
    const entry = grandCollectionAction();
    expect(entry.costBranches).toEqual([0, 1]);
    const prompt = costChoicePromptFor(state, POOL_DEPS, entry);
    expect(prompt).toEqual({
      kind: "branch",
      options: [
        { branch: 0, label: "exhaust your hero" },
        { branch: 1, label: "spend 2 resources of any type" },
      ],
    });
  });

  test("an ordinary action with no either/or cost prompts nothing", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const basic = legal.legal.find(
      (entry) => entry.action.kind === "basicAttack" || entry.action.kind === "basicThwart",
    );
    if (!basic) return; // Nothing to pose the negative case with this seed; not this test's concern.
    expect(costChoicePromptFor(state, POOL_DEPS, basic)).toBeNull();
  });

  test("a single payable branch is not a real choice, and prompts nothing", () => {
    const entry = grandCollectionAction();
    const oneBranch: LegalAction = { ...entry, costBranches: [0] };
    expect(costChoicePromptFor(state, POOL_DEPS, oneBranch)).toBeNull();
  });
});

describe("cost-choice mode: an 'up to N' counter cost (We Are Groot)", () => {
  beforeEach(intoTurn);

  // We Are Groot (`gmw` 16006) needs Groot himself in play with growth counters on him, which this seed's opening
  // turn does not reach — so this exercises the prompt shape directly against the real ability id and a synthetic
  // `LegalAction`, the same way `discard-choice-model.test.ts`'s own narrower cases do when the full scenario state
  // is not worth driving to. `costChoicePromptFor` reads a `useAbility` cost straight off the registry (no card
  // lookup for that action kind), so this is exactly the prompt the real thing would show once the cost is legal.
  test("the counter range is offered with the printed counter's own name", () => {
    const base = grandCollectionAction();
    if (base.action.kind !== "useAbility") throw new Error("expected a useAbility action");
    const { costBranches: _dropped, ...rest } = base;
    const groot: LegalAction = {
      ...rest,
      action: {
        kind: "useAbility",
        instanceId: base.action.instanceId,
        abilityId: "16006.we-are-groot-action" as AbilityId,
      },
      costCounters: { min: 1, max: 4 },
    };
    const prompt = costChoicePromptFor(state, POOL_DEPS, groot);
    expect(prompt).toEqual({ kind: "counters", min: 1, max: 4, label: "growth" });
  });

  test("a fixed count (min === max) is not a real choice, and prompts nothing", () => {
    const base = grandCollectionAction();
    const { costBranches: _dropped, ...rest } = base;
    const fixed: LegalAction = { ...rest, costCounters: { min: 4, max: 4 } };
    expect(costChoicePromptFor(state, POOL_DEPS, fixed)).toBeNull();
  });
});
