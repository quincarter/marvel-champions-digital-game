/**
 * A Hero/Alter-Ego Action printed on a main scheme or an environment — not a character — is still a real player
 * decision the board has to offer. `schemes.ts`/`zones.ts` used to register these cards' tap targets with no
 * `onTap` at all (or, for an environment, one that only opened Inspect), so `legalActions` could list a
 * `useAbility` entry for them and there was still no way to trigger it from the board. This checks the view-model
 * layer both draw functions now read from — `highlights().usableAbilities` and `abilityActionsFor` — rather than
 * the Phaser draw itself, the same split `board-model.test.ts` already uses.
 */

import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../../engine/host.js";
import { LocalEngineHost } from "../../engine/local-host.js";
import { SessionStore } from "../../store/session-store.js";
import { boardModel } from "../../view/board-model.js";
import { abilityActionsFor, highlights } from "../../view/highlights.js";
import { POOL_DEPS } from "../../content/pool.js";

const GROOT_MUSEUM: SessionConfig = {
  scenarioId: "infiltrate-the-museum",
  difficulty: "standard",
  players: [{ starterDeckId: "groot-protection" }],
  seed: 2026,
};

const ROCKET_ESCAPE: SessionConfig = {
  scenarioId: "escape-the-museum",
  difficulty: "standard",
  players: [{ starterDeckId: "rocket-raccoon-aggression" }],
  seed: 2026,
};

/** Plays past setup's own choice prompts, then into hero form — both cards' abilities are Hero Actions. */
async function intoHeroTurn(config: SessionConfig, maxSteps = 40): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal || legal.actions.kind !== "choice") break;
    const { choice } = legal.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  if (store.state.legal?.actions.kind === "turn") {
    const changeForm = store.state.legal.actions.legal.find((entry) => entry.action.kind === "changeForm");
    if (changeForm) await store.dispatch(changeForm.example);
  }
  return store;
}

describe("a player-usable ability printed on a non-character board card", () => {
  test("The Grand Collection's Hero Action is offered on the main scheme's own instance", async () => {
    const store = await intoHeroTurn(GROOT_MUSEUM);
    const { game, perspectiveId, legal } = store.state;
    expect(game).not.toBeNull();
    expect(perspectiveId).not.toBeNull();
    expect(legal).not.toBeNull();
    if (!game || !perspectiveId || !legal) return;

    const model = boardModel(game, perspectiveId, POOL_DEPS);
    expect(model.mainScheme.name).toContain("Grand Collection");

    const marks = highlights(legal.actions);
    expect(marks.usableAbilities.has(model.mainScheme.instanceId)).toBe(true);

    const abilities = abilityActionsFor(legal.actions, model.mainScheme.instanceId);
    expect(abilities.length).toBeGreaterThan(0);
    expect(abilities[0]!.action.abilityId).toContain("the-grand-collection-action");
  });

  test("Library Labyrinth's \"This way?\" Hero Action is offered on the environment's own instance", async () => {
    const store = await intoHeroTurn(ROCKET_ESCAPE);
    const { game, perspectiveId, legal } = store.state;
    expect(game).not.toBeNull();
    expect(perspectiveId).not.toBeNull();
    expect(legal).not.toBeNull();
    if (!game || !perspectiveId || !legal) return;

    const model = boardModel(game, perspectiveId, POOL_DEPS);
    expect(model.environments).toHaveLength(1);
    const labyrinth = model.environments[0]!;
    expect(labyrinth.name).toContain("Library Labyrinth");

    const marks = highlights(legal.actions);
    expect(marks.usableAbilities.has(labyrinth.instanceId)).toBe(true);

    const abilities = abilityActionsFor(legal.actions, labyrinth.instanceId);
    expect(abilities.length).toBeGreaterThan(0);
    expect(abilities[0]!.action.abilityId).toBe("16085a.this-way");
  });
});
