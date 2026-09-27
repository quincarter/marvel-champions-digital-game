/**
 * The choice sheet's presentation of a `lookAt` prompt, over a real Spider-Woman game: Jessica Drew's "Look at the top
 * card of any deck" used to bind the card silently and show nothing (the reported bug). Now it opens a sheet that
 * shows the card, names where it is, and answers with a single "Done".
 */

import { describe, expect, test } from "vitest";
import type { PendingChoice } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  canConfirmChoice,
  canDeclineChoice,
  commitLabelOf,
  confirmMinimum,
  initialChoiceSelection,
  isAcknowledgeOnly,
} from "./choice-focus.js";
import { choiceHeaderText } from "./choice-source.js";
import { lookAtTitleOf } from "./look-at-choice.js";

async function jessicaDrewLooksAt(option: "0" | "1") {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "spider-woman-aggression-justice" }],
    seed: 11,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as { choice: PendingChoice };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const look = legal.legal.find(
    (e) => e.action.kind === "useAbility" && e.action.abilityId === "04031b.jessica-drew-action",
  );
  if (!look) throw new Error("expected Jessica Drew's action to be usable");
  await store.dispatch(look.example);
  await store.resolveChoice([option]);
  const choice = store.state.game!.pendingChoice!;
  return { store, choice };
}

describe("lookAt choice sheet: Jessica Drew", () => {
  test("names the encounter deck's top card, and the sheet is a single Done", async () => {
    const { store, choice } = await jessicaDrewLooksAt("0");
    const state = store.state.game!;
    expect(choice.prompt.kind).toBe("lookAt");
    expect(choice.options).toHaveLength(1);

    const title = lookAtTitleOf(state, choice, store.state.perspectiveId ?? choice.playerId);
    expect(title).toBe("Look at the top card of the encounter deck");
    expect(choiceHeaderText(state, choice, POOL_DEPS, title)).toMatch(/look at the top card of the encounter deck$/);

    expect(isAcknowledgeOnly(choice)).toBe(true);
    expect(commitLabelOf(choice)).toBe("Done");
    expect(canDeclineChoice(choice)).toBe(false);
    expect(initialChoiceSelection(choice)).toEqual([]);
    expect(confirmMinimum(choice)).toBe(0);
    expect(canConfirmChoice(choice, 0)).toBe(true);

    // "Done" sends the empty answer, which the engine accepts; nothing is left open.
    expect(await store.resolveChoice([])).toBe(true);
    expect(store.state.game!.pendingChoice).toBeNull();
  });

  test("solo, 'a player's deck' is your own, named as such", async () => {
    const { store, choice } = await jessicaDrewLooksAt("1");
    expect(lookAtTitleOf(store.state.game!, choice, choice.playerId)).toBe("Look at the top card of your deck");
  });
});

describe("choice sheet commit: a decision is unchanged", () => {
  const options = [{ optionId: "a", label: "a", ref: { kind: "none" } }] as unknown as PendingChoice["options"];

  test("an optional pick still has Confirm and Decline", () => {
    const choice = { options, minSelections: 0, maxSelections: 1 };
    expect(isAcknowledgeOnly(choice)).toBe(false);
    expect(commitLabelOf(choice)).toBe("Confirm");
    expect(canDeclineChoice(choice)).toBe(true);
    expect(canConfirmChoice(choice, 0)).toBe(false);
  });
});
