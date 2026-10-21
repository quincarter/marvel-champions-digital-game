/**
 * A real one-seat game stopped on the board where Wasp's Giant face may divide her basic attack (issue #322): Wasp
 * (Aggression) against Rhino, in Giant hero form on her own turn, with two Hydra Mercenaries (01101, 3 HP, guard)
 * engaged with her. Played forward through the store with `SessionConfig.stack` and the engine's own example commands,
 * never a state edit, so it replays byte for byte like any saved game. `dev-giant-wasp-game.test.ts` proves it reaches
 * that state.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const HYDRA_MERCENARY = "01101";
/** Wasp's three faces: Tiny hero (0), alter-ego, Giant hero (1). */
export const GIANT_FORM = { heroForm: 1 } as const;

export const GIANT_WASP_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "wsp-aggression" }],
  seed: 3,
  // Each villain phase: a boost card with no icons for Rhino's attack, then a Hydra Mercenary as the encounter card.
  stack: { encounter: ids("01104", HYDRA_MERCENARY, "01104", HYDRA_MERCENARY) },
};

/** The Hydra Mercenaries engaged with the seat. */
export const mercenaries = (game: GameState): readonly string[] =>
  game.players[0]!.playArea.filter((id) => codeOf(game, id) === HYDRA_MERCENARY);

/** True once Wasp is in Giant form on her own turn with two Mercenaries engaged (the test reads the same thing). */
export function giantWaspReached(game: GameState): boolean {
  return isGiant(game) && mercenaries(game).length >= 2;
}

const isGiant = (game: GameState): boolean =>
  game.players[0]!.identity.form === "hero" && game.players[0]!.identity.heroFormIndex === GIANT_FORM.heroForm;

export const BREAKIN_AND_TAKIN = "01107";

/** The same game for her basic thwart: Breakin' & Takin' (01107, a side scheme) comes out beside the main scheme. */
export const GIANT_WASP_THWART_DEV_CONFIG: SessionConfig = {
  ...GIANT_WASP_DEV_CONFIG,
  stack: { encounter: ids("01104", BREAKIN_AND_TAKIN) },
};

/** True once Wasp is in Giant form on her own turn with Breakin' & Takin' and the main scheme both holding threat. */
export function giantWaspThwartReached(game: GameState): boolean {
  const side = game.villainArea.find((id) => codeOf(game, id) === BREAKIN_AND_TAKIN);
  const threat = (id: string): number => game.instances[id]?.threat ?? 0;
  return isGiant(game) && side !== undefined && threat(side) > 0 && threat(game.mainScheme.instanceId) > 0;
}

/**
 * Wasp changes to her Giant face on her first turn and then ends her turns until the table is set: two Mercenaries
 * engaged, or, with the thwart config, the side scheme out.
 */
export async function startGiantWaspDevGame(
  store: SessionStore,
  config: SessionConfig = GIANT_WASP_DEV_CONFIG,
  reached: (game: GameState) => boolean = giantWaspReached,
): Promise<void> {
  await store.start(config);
  for (let step = 0; step < 20; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game || reached(game)) return;
    const giant = turn.legal.find(
      (entry) =>
        entry.action.kind === "changeForm" &&
        typeof entry.action.to === "object" &&
        entry.action.to.heroForm === GIANT_FORM.heroForm,
    );
    if (giant && !isGiant(game)) {
      await store.dispatch(giant.example);
      continue;
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
