/**
 * `choiceSourcePanelOf`/`sourceCardPanelFor`, checked against real games wherever a real one can reach the case
 * (the same convention `choice-source.test.ts` uses), and against a hand-built `PendingChoice` layered onto a real
 * game's own instances for the prompt kinds a short scripted game doesn't happen to visit.
 */

import { describe, expect, test } from "vitest";
import { choiceId, type GameState, type PendingChoice, type PlayerId } from "@mc/engine";
import { abilityId } from "@mc/content";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { cardName } from "./names.js";
import { inspectModel } from "./inspect-model.js";
import { choiceSourcePanelOf, sourceCardPanelFor } from "./choice-source-panel.js";

const BASE: Omit<PendingChoice, "prompt" | "playerId"> = {
  choiceId: choiceId("c1"),
  minSelections: 0,
  maxSelections: 1,
  options: [],
  frameId: null,
  ordered: false,
  soleDecider: false,
  authority: "player",
};

/** Doctor Strange, flipped to hero form — Spell Mastery ("09001a.spell-mastery") only shows up in `activeAbilityRefs` once he's on that face. */
async function drsHeroState(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "drs-protection" }],
    seed: 439,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  const legal = store.state.legal!.actions;
  if (legal.kind === "turn") {
    const flip = legal.legal.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  return store.state.game!;
}

async function spiderManState(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  return store.state.game!;
}

describe("choiceSourcePanelOf", () => {
  test("returns null exactly where choiceSourceOf does — a mulligan has no single source", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = { ...BASE, playerId: "p1" as PlayerId, prompt: { kind: "mulligan", handSize: 5 } };
    expect(choiceSourcePanelOf(state, choice, "p1" as PlayerId, POOL_DEPS)).toBeNull();
  });

  test("payForCard: 'Paying N for <name>' when nothing prints a sub-ability label", async () => {
    const state = await spiderManState();
    const player = state.players[0]!;
    const cardInHand = player.hand[0]!;
    const choice: PendingChoice = {
      ...BASE,
      playerId: player.playerId,
      prompt: { kind: "payForCard", instanceId: cardInHand, abilityId: abilityId("no-such.ability"), cost: 2 },
    };

    const panel = choiceSourcePanelOf(state, choice, player.playerId, POOL_DEPS);
    expect(panel).not.toBeNull();
    expect(panel!.instanceId).toBe(cardInHand);
    expect(panel!.name).toBe(cardName(state, cardInHand));
    expect(panel!.art).not.toBeNull();
    expect(panel!.rulesText.length).toBeGreaterThan(0);
    expect(panel!.abilityLine).toBe(`Paying 2 for ${cardName(state, cardInHand)}`);
  });

  test("payForAbility: names the card's own printed sub-ability label when it has one", async () => {
    const state = await drsHeroState();
    const player = state.players[0]!;
    const identity = player.identity.instanceId;
    const choice: PendingChoice = {
      ...BASE,
      playerId: player.playerId,
      prompt: {
        kind: "payForAbility",
        instanceId: identity,
        abilityId: abilityId("09001a.spell-mastery"),
        cost: 1,
      },
    };

    const panel = choiceSourcePanelOf(state, choice, player.playerId, POOL_DEPS);
    expect(panel).not.toBeNull();
    expect(panel!.instanceId).toBe(identity);
    expect(panel!.abilityLine).toBe("Paying 1 for Spell Mastery");
  });

  test("a real chooseTarget traced back to a card with exactly one active ability — the reported bug's own scenario", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "drs-protection" }],
      seed: 439,
    });
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    let legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const flip = legal.legal.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }
    legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const spellMastery = legal.legal.find(
      (e) => e.action.kind === "useAbility" && e.action.abilityId === "09001a.spell-mastery",
    );
    if (!spellMastery) throw new Error("expected Spell Mastery to be usable");
    await store.dispatch(spellMastery.example);

    const afterLegal = store.state.legal?.actions;
    if (afterLegal?.kind !== "choice" || afterLegal.choice.prompt.kind !== "chooseTarget") {
      throw new Error(`expected a pending chooseTarget, got ${afterLegal?.kind}`);
    }
    const { choice } = afterLegal;
    const state = store.state.game!;

    const panel = choiceSourcePanelOf(state, choice, store.state.perspectiveId ?? choice.playerId, POOL_DEPS);
    expect(panel).not.toBeNull();
    expect(panel!.name).toBe("Crimson Bands of Cyttorak");
    expect(panel!.rulesText).toContain("Stun an enemy");
    // No printed sub-ability label on this card's one ability, so the ability line falls back to its structural
    // trigger header (`view/inspect-model.ts`'s own `triggerLabel`) — never an invented description.
    expect(panel!.abilityLine).toBe("Special");
  });
});

describe("sourceCardPanelFor", () => {
  test("mirrors inspectModel's own name/typeLine/rulesText/art for the given instance, with the caller's own ability line attached unchanged", async () => {
    const state = await drsHeroState();
    const player = state.players[0]!;
    const instanceId = player.identity.instanceId;
    const model = inspectModel(state, instanceId, null, player.playerId, POOL_DEPS);

    const panel = sourceCardPanelFor(state, instanceId, player.playerId, POOL_DEPS, "Attacking you");
    expect(panel).toEqual({
      instanceId,
      art: model.art,
      name: model.name,
      typeLine: model.typeLine,
      rulesText: model.rulesText,
      abilityLine: "Attacking you",
    });
  });

  test("defaults to a null ability line when the caller doesn't have one to say", async () => {
    const state = await drsHeroState();
    const player = state.players[0]!;
    const panel = sourceCardPanelFor(state, player.identity.instanceId, player.playerId, POOL_DEPS);
    expect(panel.abilityLine).toBeNull();
  });
});
