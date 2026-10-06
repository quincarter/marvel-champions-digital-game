import { afterEach, describe, expect, test } from "vitest";
import type { InstanceId, LegalAction } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { eventAbilityOptions, needsEventAbilityChoice } from "../view/event-ability-choice.js";
import { codeOf } from "./dev-game-steps.js";
import {
  PLUMAGE_ATTACK,
  PLUMAGE_CARD,
  PLUMAGE_THWART,
  startWhichAbilityDevGame,
  unscopeAdaptivePlumage,
} from "./dev-which-ability-game.js";
import { SessionStore } from "./session-store.js";

let undo: (() => void) | null = null;
afterEach(() => {
  undo?.();
  undo = null;
});

async function open(unscoped: boolean): Promise<{ store: SessionStore; card: InstanceId }> {
  if (unscoped) undo = unscopeAdaptivePlumage();
  const store = new SessionStore(new LocalEngineHost());
  await startWhichAbilityDevGame(store);
  const game = store.state.game!;
  const card = game.players[0]!.hand.find((id) => codeOf(game, id) === PLUMAGE_CARD)!;
  return { store, card };
}

const entryFor = (store: SessionStore, card: InstanceId): LegalAction | undefined => {
  const actions = store.state.legal?.actions;
  const list = actions?.kind === "turn" ? actions.legal : [];
  return list.find((e) => e.action.kind === "playCard" && e.action.instanceId === card);
};

describe("the which-ability dev game and the event ability options", () => {
  test("with both Actions usable the engine lists both and each option names its own ability", async () => {
    const { store, card } = await open(true);
    const entry = entryFor(store, card)!;
    expect(entry.abilities).toEqual([PLUMAGE_THWART, PLUMAGE_ATTACK]);
    expect(needsEventAbilityChoice(entry)).toBe(true);
    const options = eventAbilityOptions(store.state.game!, entry, POOL_DEPS);
    expect(options.map((o) => o.label)).toEqual(["If you are Angel", "If you are Archangel"]);
    expect(options.map((o) => o.abilityId)).toEqual([PLUMAGE_THWART, PLUMAGE_ATTACK]);
    for (const option of options) {
      expect(option.command).toMatchObject({ type: "playCard", cardInstanceId: card, abilityId: option.abilityId });
    }
  });

  test("the real card, one face usable, is no choice and offers no options", async () => {
    const { store, card } = await open(false);
    const entry = entryFor(store, card)!;
    expect(entry.abilities ?? []).not.toContain(PLUMAGE_ATTACK);
    expect(needsEventAbilityChoice(entry)).toBe(false);
    expect(eventAbilityOptions(store.state.game!, entry, POOL_DEPS)).toEqual([]);
  });
});
