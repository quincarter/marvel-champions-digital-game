/**
 * A real one-seat game stopped on the board where Organizational Support (50014) can pay in more than one way (issue
 * #279): Maria Hill in hero form with Grant Ward and Command Team (S.H.I.E.L.D. cards, sharing a trait with her) ready
 * in play, and Organizational Support and Victoria Hand (cost 3) in hand. Played forward through the store with
 * `SessionConfig.stack` and the engine's own example commands, never a state edit. Kept out of `boot.ts`;
 * `dev-org-support-game.test.ts` proves it reaches that state.
 */
import { cardsInPlay } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const ORG_SUPPORT_CARD = "50014";
export const VICTORIA_HAND_CARD = "50012";
export const GRANT_WARD_CARD = "50022";
export const COMMAND_TEAM_CARD = "50016";
const HELD = [ORG_SUPPORT_CARD, VICTORIA_HAND_CARD];
const PLAYED = [GRANT_WARD_CARD, COMMAND_TEAM_CARD];

export const ORG_SUPPORT_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "maria-hill-leadership" }],
  seed: 3,
  stack: {
    // Special Funding and Energy pay for Command Team (2); Grant Ward costs nothing.
    players: { 0: ids(GRANT_WARD_CARD, COMMAND_TEAM_CARD, "50007", "50025", ORG_SUPPORT_CARD, VICTORIA_HAND_CARD) },
  },
};

export async function startOrgSupportDevGame(store: SessionStore): Promise<void> {
  await store.start(ORG_SUPPORT_DEV_CONFIG);
  for (let step = 0; step < 20; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const inPlay = (code: string): boolean => cardsInPlay(game).some((id) => codeOf(game, id) === code);
    const held = HELD.every((code) => me.hand.some((id) => codeOf(game, id) === code));
    if (me.identity.form === "hero" && PLAYED.every(inPlay) && held) return;
    const flip = me.identity.form === "alterEgo" ? turn.legal.find((e) => e.action.kind === "changeForm") : undefined;
    if (flip) {
      await store.dispatch(flip.example);
      continue;
    }
    const next = PLAYED.find((code) => !inPlay(code));
    const play = turn.legal.find((e) => e.action.kind === "playCard" && codeOf(game, e.action.instanceId) === next);
    if (play?.example.type === "playCard") {
      const filler = me.hand.filter((id) => ![...PLAYED, ...HELD].includes(codeOf(game, id)));
      const cost = next === COMMAND_TEAM_CARD ? 2 : 0;
      await store.dispatch({ ...play.example, payment: filler.slice(0, cost).map((fromHand) => ({ fromHand })) });
      continue;
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
