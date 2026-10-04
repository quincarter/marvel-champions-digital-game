/**
 * Which face of a hero identity a prompt, a walkthrough beat, a log line or a thumbnail shows. Reported 2026-10-04:
 * while a hero stood in alter-ego form during the villain phase, Jennifer Walters' "I Object!" interrupt was offered
 * under "She-Hulk" — the engine labels every card option with the card's own name (the hero side), and the
 * villain-phase interrupt cards drew `{ kind: "front" }`. Everything here is read off the live `form` /
 * `heroFormIndex` through `identityNameOf` / `faceOf` / `abilityFaceOf`.
 */

import { describe, expect, test } from "vitest";
import { abilityId } from "@mc/content";
import type { ChoiceOption, GameEvent, GameState, InstanceId, PendingChoice, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { abilityFaceOf, faceOf } from "./board-model.js";
import { appendCardHistory, cardHistoryOf, emptyCardHistoryLog } from "./card-history.js";
import { choiceSourcePanelOf } from "./choice-source-panel.js";
import { identityNameOf, optionLabelOf } from "./names.js";
import { interruptActionLabel, pauseFor } from "./villain-walkthrough.js";

interface Offer {
  readonly state: GameState;
  readonly choice: PendingChoice;
  readonly option: ChoiceOption;
  readonly viewer: PlayerId;
  readonly store: SessionStore;
  readonly events: readonly GameEvent[];
}

/** Starts a game and ends turns until the identity is offered `wanted` as a `chooseTriggers` option. */
async function offerOf(deckId: string, wanted: string, seed: number): Promise<Offer> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: deckId }], seed });
  const events: GameEvent[] = [];
  for (let step = 0; step < 60; step++) {
    const actions = store.state.legal!.actions;
    events.push(...store.state.lastEvents);
    if (actions.kind === "choice") {
      const { choice } = actions;
      const option = choice.options.find((o) => o.ref.kind === "ability" && String(o.ref.abilityId) === wanted);
      if (choice.prompt.kind === "chooseTriggers" && option) {
        return { state: store.state.game!, choice, option, viewer: choice.playerId, store, events };
      }
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else {
      const end = actions.kind === "turn" ? actions.legal.find((e) => e.action.kind === "endTurn") : undefined;
      if (!end) break;
      await store.dispatch(end.example);
    }
  }
  throw new Error(`${wanted} was never offered`);
}

/** The same game with the seat's identity put in `form` (pure view-model input; the engine is not asked). */
function inForm(state: GameState, form: "hero" | "alterEgo", heroFormIndex: number | null = null): GameState {
  const [seat, ...rest] = state.players;
  return {
    ...state,
    players: [{ ...seat!, identity: { ...seat!.identity, form, heroFormIndex } }, ...rest],
  } as GameState;
}

describe("She-Hulk's I Object! (an alter-ego interrupt in the villain phase)", () => {
  test("alter-ego form: the source panel, the option label, the walkthrough beat and the thumbnail say Jennifer Walters", async () => {
    const { state, choice, option, viewer } = await offerOf("core-she-hulk-aggression", "01019b.i-object", 5);
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const identityId = (option.ref as { instanceId: InstanceId }).instanceId;

    const panel = choiceSourcePanelOf(state, choice, viewer, POOL_DEPS)!;
    expect(panel.name).toBe("Jennifer Walters");
    expect(panel.art?.url).toContain("01019b");
    expect(panel.typeLine).toMatch(/alter-ego/i);

    expect(optionLabelOf(state, option)).toBe("Jennifer Walters");
    expect(option.label).toBe("She-Hulk"); // the engine's own label is the hero side: that is the bug being guarded
    expect(pauseFor(choice, state, viewer).offer).toContain("Jennifer Walters");
    expect(pauseFor(choice, state, viewer).offer).not.toContain("She-Hulk");
    expect(identityNameOf(state, identityId)).toBe("Jennifer Walters");
    expect(faceOf(state, identityId)).toEqual({ kind: "alterEgo" });
    expect(interruptActionLabel(state, { optionId: option.optionId, instanceId: identityId, abilityId: null })).toBe(
      "Use Jennifer Walters",
    );
  });

  test("hero form: the same views say She-Hulk", async () => {
    const { state, choice, option, viewer } = await offerOf("core-she-hulk-aggression", "01019b.i-object", 5);
    const hero = inForm(state, "hero", 0);
    const identityId = (option.ref as { instanceId: InstanceId }).instanceId;
    expect(optionLabelOf(hero, option)).toBe("She-Hulk");
    expect(pauseFor(choice, hero, viewer).offer).toContain("She-Hulk");
    expect(identityNameOf(hero, identityId)).toBe("She-Hulk");
    expect(faceOf(hero, identityId)).toEqual({ kind: "hero" });
    expect(choiceSourcePanelOf(hero, choice, viewer, POOL_DEPS)!.name).toBe("Jennifer Walters");
  });

  test("an ability panel shows the side that prints the ability, even if the form changed since it was offered", async () => {
    const { state, choice, viewer } = await offerOf("core-she-hulk-aggression", "01019b.i-object", 5);
    const flipped = inForm(state, "hero", 0);
    const panel = choiceSourcePanelOf(flipped, choice, viewer, POOL_DEPS)!;
    expect(panel.name).toBe("Jennifer Walters");
    expect(panel.art?.url).toContain("01019b");
    expect(panel.art?.url).not.toContain("01019a");
  });

  test("the card history names the face that was up when the ability resolved", async () => {
    const { store, option, viewer, state, events } = await offerOf("core-she-hulk-aggression", "01019b.i-object", 5);
    const identityId = (option.ref as { instanceId: InstanceId }).instanceId;
    await store.resolveChoice([option.optionId]);
    const log = appendCardHistory(emptyCardHistoryLog(), [...events, ...store.state.lastEvents]);
    const lines = cardHistoryOf(log, identityId, store.state.game!, viewer, POOL_DEPS).map((line) => line.text);
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const text = lines.join(" | ");
    expect(text).toContain("Jennifer Walters");
    expect(text).not.toContain("She-Hulk");
  });
});

describe("other identities", () => {
  test("a second hero (Ghost-Spider) names and pictures the alter-ego face in alter-ego form", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "ghost-spider" }],
      seed: 3,
    });
    const state = store.state.game!;
    const id = state.players[0]!.identity.instanceId;
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    expect(identityNameOf(state, id)).toBe("Gwen Stacy");
    expect(optionLabelOf(state, { label: "Ghost-Spider", ref: { kind: "card", instanceId: id } })).toBe("Gwen Stacy");
    expect(identityNameOf(inForm(state, "hero", 0), id)).toBe("Ghost-Spider");
    // A non-identity option keeps the engine's label.
    expect(optionLabelOf(state, { label: "Remove 1 counter", ref: { kind: "none" } })).toBe("Remove 1 counter");
  });

  test("a multi-form identity (Ant-Man) answers per form and per ability", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "ant-leadership" }],
      seed: 3,
    });
    const state = store.state.game!;
    const id = state.players[0]!.identity.instanceId;
    const giant = inForm(state, "hero", 1);
    expect(identityNameOf(state, id)).not.toBe(identityNameOf(giant, id));
    expect(faceOf(giant, id)).toEqual({ kind: "heroForm", index: 1 });
    expect(faceOf(inForm(state, "hero", 0), id)).toEqual({ kind: "hero" });
    // Each ability belongs to its own printed side whatever the form is now.
    const giantNuisance = abilityId("12001c.giant-nuisance");
    const unwind = abilityId("12001b.time-to-unwind");
    const puny = abilityId("12001a.puny-pest");
    expect(abilityFaceOf(state, id, giantNuisance)).toEqual({ kind: "heroForm", index: 1 });
    expect(abilityFaceOf(giant, id, giantNuisance)).toEqual({ kind: "heroForm", index: 1 });
    expect(abilityFaceOf(giant, id, unwind)).toEqual({ kind: "alterEgo" });
    expect(abilityFaceOf(state, id, puny)).toEqual({ kind: "hero" });
    expect(abilityFaceOf(state, id, null)).toEqual({ kind: "alterEgo" });
  });

  test("another seat's identity is named by its own form (multi-seat)", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 3,
    });
    const state = store.state.game!;
    const [first, second] = state.players;
    const flipped = {
      ...state,
      players: [first!, { ...second!, identity: { ...second!.identity, form: "hero", heroFormIndex: 0 } }],
    } as GameState;
    expect(identityNameOf(flipped, first!.identity.instanceId)).toBe("Jennifer Walters");
    expect(identityNameOf(flipped, second!.identity.instanceId)).toBe("Spider-Man (Peter Parker)");
  });
});
