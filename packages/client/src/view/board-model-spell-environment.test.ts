/**
 * A Spell card put into a player's own play area (Ebony Maw, `mts` 21076-21078, "puts that card into play in
 * their play area" — Fireball/Manipulation/Pacification, all `type: "environment"`, docs/phase7-wave4.md §3.17,
 * §5). `myPlayArea` already draws anything in `player.playArea` through `characterPanel` regardless of type, so
 * this needed no zone-placement fix — but `characterPanel`'s own `subtitleOf` fell through to a raw snake_case
 * default ("environment") for a type it had no case for, inconsistent with every other subtitle's title case
 * ("Ally", "Minion", "Support").
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const EBONY_MAW: SessionConfig = {
  scenarioId: "ebony-maw",
  difficulty: "standard",
  players: [{ starterDeckId: "adam-warlock-all-aspects" }],
  seed: 8,
};

describe("Ebony Maw: a Spell in a player's own play area", () => {
  test("plays without crashing and shows the Spell with a legible subtitle, its traits/keywords/counters", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(EBONY_MAW);
    let found: { readonly instanceId: string; readonly name: string } | null = null;
    for (let step = 0; step < 400 && !found; step++) {
      const legal = store.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
        continue;
      }
      if (legal.actions.kind !== "turn") break;
      const state = store.state.game!;
      const me = state.players.find((p) => p.playerId === store.state.perspectiveId)!;
      const spellId = me.playArea.find((id) => {
        const card = state.cardPool[state.instances[id]!.cardId];
        return card && "traits" in card && (card.traits as readonly string[]).includes("SPELL");
      });
      if (spellId) {
        found = { instanceId: spellId, name: state.cardPool[state.instances[spellId]!.cardId]!.name };
        break;
      }
      const entry = legal.actions.legal.find((e) => e.action.kind === "endTurn") ?? legal.actions.legal[0];
      if (!entry) break;
      await store.dispatch(entry.example);
    }
    expect(found, "a Spell should reach a play area within 400 steps of this seeded game").not.toBeNull();

    const model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
    const panel = model.myPlayArea.find((p) => p.instanceId === found!.instanceId);
    expect(panel, found!.name).toBeDefined();
    expect(panel!.name).toBe(found!.name);
    expect(panel!.subtitle).toBe("Environment");
    expect(panel!.traits).toContain("SPELL");
    expect(panel!.keywords).toContain("surge");
    expect(panel!.hp).toBeNull();
  });
});
