/**
 * The `?screen=board&fixture=tips` dev jump (`scenes/boot.ts`): a real, replay-safe Rhino game (Spider-Man,
 * Justice) that stops at the start of round 2's player turn, having lived through round 1's villain phase with a
 * minion engaged and a boost card with icons flipped — enough for `view/guide-tips.ts#tipsFor` to have a real,
 * eligible candidate the moment round 2 begins (guided mode G10e, `docs/guided-mode.md` §4). Kept out of `boot.ts`
 * so `dev-tips-game.test.ts` can prove the fixture reaches the state it claims, the same split
 * `store/dev-hold-on-game.ts` uses for its own two fixtures.
 *
 * Built on `SessionConfig.stack`/a fixed seed (G1), played forward through the real session core with no state
 * edits — replays byte for byte from `{ seed, stack, commands }` like any other saved game.
 *
 * **The stacked encounter deck.** The player stays in alter-ego form for the whole fixture (no `changeForm`
 * dispatched), so Rhino's round-1 activation schemes rather than attacks (RRG 1.8 "Activation" p. 6: the villain
 * attacks only if a hero is in hero form) — the simplest villain phase shape, with no `declareDefender` choice to
 * script. An ordinary round draws exactly two encounter cards in order: the villain's own activation boost, then
 * the step-3 reveal (`dev-hold-on-game.ts`'s own doc comment covers the general shape; there's no "the villain
 * schemes" effect here to draw a hidden extra boost, so round 1 is just the two cards below):
 *
 * - Round 1 step-2 boost: Charge (01099, 2 boost icons, attach-to-Rhino text that only fires when *revealed*, never
 *   when drawn as a plain boost — `dev-hold-on-game.ts`'s own r4 boost reuses the same card for the same reason).
 *   Flipping it fires `tipsFor`'s `situation:boostFlip` trigger.
 * - Round 1 step-3 reveal: Hydra Mercenary (01101, Guard, no "When Revealed" text). A minion with no other minion
 *   already in play, and a lone player at the table, so RRG 1.8 "Minion" (p. 29) engages it with that player
 *   automatically — no choice to resolve. Fires `situation:minionEngaged` and the Guard glossary catch-all
 *   (`keyword:guard`).
 *
 * **Readying isn't relevant here.** Unlike the hold-on fixtures, nothing in this fixture ever exhausts the hero
 * (alter-ego the whole time, no defend), so there's no readying bookkeeping to get right.
 */
import { cardId } from "@mc/content";
import { minionsEngagedWith, type GameState, type PlayerId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import type { SessionStore } from "./session-store.js";

export const TIPS_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4242,
  stack: {
    encounter: [
      cardId("01099"), // r1 step-2 scheme-activation boost (Charge, 2 icons — never revealed, so no attach fires)
      cardId("01101"), // r1 step-3 reveal: Hydra Mercenary — engages the lone player, Guard keyword
    ],
  },
};

/**
 * Declines every choice (mulligan kept as dealt, any optional trigger declined) and ends the turn exactly once,
 * carrying the game from round 1's opening hand through round 1's villain phase to round 2's own turn — the
 * fixture never needs to defend or flip, so this is simpler than `dev-hold-on-game.ts`'s own
 * `playForwardDeclining`.
 */
async function playForwardToRoundTwo(store: SessionStore): Promise<void> {
  for (let step = 0; step < 100; step++) {
    const game = store.state.game;
    if (!game || game.outcome) return;
    if (game.round >= 2 && store.state.legal?.actions.kind === "turn") return;

    const actions = store.state.legal?.actions;
    if (!actions) return;

    if (actions.kind === "choice") {
      await store.resolveChoice(actions.choice.options.slice(0, actions.choice.minSelections).map((o) => o.optionId));
      continue;
    }
    if (actions.kind !== "turn") return;

    const end = actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

/**
 * True once `TIPS_CONFIG`'s fixture has actually reached its promised boundary: a minion engaged with the
 * perspective player, round 2, the player's own turn. Exported so `dev-tips-game.test.ts` and the dev jump's own
 * caller can both assert the same thing rather than re-deriving it.
 */
export function tipsFixtureReachedBoundary(game: GameState, playerId: PlayerId): boolean {
  return game.round >= 2 && minionsEngagedWith(game, playerId).length > 0;
}

/** Starts `TIPS_CONFIG` and plays it forward to the round-2 boundary (see the config's own doc comment). */
export async function startTipsGame(store: SessionStore): Promise<void> {
  await store.start(TIPS_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]); // mulligan: keep the dealt hand.
  await playForwardToRoundTwo(store);
}
