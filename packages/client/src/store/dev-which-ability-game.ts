/**
 * A real one-seat game stopped on Angel's own turn in Angel hero form (42001), holding Adaptive Plumage (42003): an
 * event with two Action abilities, "If you are Angel" (thwart) and "If you are Archangel" (attack). No real card has
 * two usable at once (each is gated to a face), so the board's "Which ability?" question never comes up in a normal
 * game; `unscopeAdaptivePlumage` lifts the two face conditions on the deps the engine is running with, so a test can
 * stage the state the engine's own `event-ability-choice.test.ts` stages with stub cards. Started through the store,
 * never a state edit. Needs the engine on the main thread (`LocalEngineHost`), where the deps are the page's own.
 */
import type { SessionConfig } from "../engine/host.js";
import { POOL_DEPS } from "../content/pool.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const PLUMAGE_CARD = "42003";
export const PLUMAGE_THWART = "42003.adaptive-plumage-action";
export const PLUMAGE_ATTACK = "42003.adaptive-plumage-hero-action";

export const WHICH_ABILITY_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "angel-protection" }],
  seed: 3,
  stack: { players: { 0: ids(PLUMAGE_CARD) } },
};

/** Drops the "If you are Angel / Archangel" face conditions from both of Plumage's Actions; returns the undo. */
export function unscopeAdaptivePlumage(): () => void {
  const saved = [PLUMAGE_THWART, PLUMAGE_ATTACK].map((id) => {
    const definition = (POOL_DEPS.abilities as Record<string, { trigger: Record<string, unknown> }>)[id]!;
    const original = definition.trigger;
    const { while: _faceCondition, ...rest } = original;
    definition.trigger = rest;
    return () => {
      definition.trigger = original;
    };
  });
  return () => saved.forEach((undo) => undo());
}

/** Plays out Angel's turn start, then flips Warren to the Angel face (the first hero face) so Plumage is playable. */
export async function startWhichAbilityDevGame(store: SessionStore): Promise<void> {
  await store.start(WHICH_ABILITY_DEV_CONFIG);
  const turn = await nextTurn(store);
  const flip = turn?.legal.find((entry) => {
    const { action } = entry;
    return action.kind === "changeForm" && typeof action.to === "object" && action.to.heroForm === 0;
  });
  if (flip) await store.dispatch(flip.example);
  await nextTurn(store);
}
