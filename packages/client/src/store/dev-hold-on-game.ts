/**
 * The `?screen=board&fixture=holdon-scheme` and `&fixture=holdon-lethal` dev jumps (`scenes/boot.ts`): two real,
 * replay-safe Rhino games stopped exactly on the boundary where `hintsFor`'s `endTurn` trigger (`view/guide-hints.ts`,
 * docs/guided-mode.md §5.2 items I and II) fires — QA item I's "verify Hold on! on a live board", which the villain
 * walkthrough and controller (G9a/G9b) only ever exercised in tests and the `?screen=holdondemo` demo before this.
 * Kept out of `boot.ts` so `dev-hold-on-game.test.ts` can prove each jump reaches the state it claims.
 *
 * Both use `SessionConfig.stack`/a fixed seed (G1) plus a scripted play-forward through the real session core —
 * no state edits, so both replay byte for byte from `{ seed, stack, commands }` like any other saved game.
 */
import { cardId } from "@mc/content";
import type { GameState, PlayerId } from "@mc/engine";
import { schemeFinishHint, lethalHint } from "../view/guide-hints.js";
import { POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import type { SessionStore } from "./session-store.js";

/**
 * The `schemeFinish` fixture (`view/guide-hints.ts`'s `schemeFinishHint`): a solo Rhino game (Spider-Man, Justice)
 * where the main scheme's threat reaches 6 of the printed 7-threat target — one point short — with the player about
 * to end their turn in hero form and a basic thwart legal, so pressing End turn fires `schemeFinishHint`
 * ("Thwart first −1").
 *
 * **The stacked encounter deck.** Reaching threat 6 with no overshoot (which would complete the scheme immediately,
 * a real loss, rather than leave the boundary state QA needs) needs the *exact* per-round card sequence controlled,
 * not just "the first N reveals": Advance (01186, "When Revealed: The villain schemes.") does a full second villain
 * activation, which itself draws its own boost card from the top of the encounter deck — one card more than an
 * ordinary round's [boost, reveal] pair. Missing that consumes what would have been the next round's own boost or
 * reveal as Advance's hidden extra boost instead, silently shifting every card after it by one position (found by
 * running this exact scenario and diffing `lastEvents` against the intended per-round deltas). The list below
 * accounts for it explicitly, round by round:
 *
 * - Round 1: boost (Armored Rhino Suit, 0 boost icons) → reveal Advance (+1 acceleration, +1 SCH from "the villain
 *   schemes" = +2 threat) → Advance's own boost (Hard to Keep Down copy 1, 0 icons, never revealed so its own text
 *   never triggers).
 * - Round 2: boost (Hard to Keep Down copy 2, 0 icons) → reveal Advance again (+2 threat) → Advance's own boost
 *   ("I'm Tough!" copy 1, 0 icons).
 * - Round 3: boost ("I'm Tough!" copy 2, 0 icons) → reveal Enhanced Ivory Horn (attaches to Rhino, +1 ATK
 *   permanent, no threat, no surge — an ordinary round, so only +1 acceleration this time).
 * - Round 4: boost (Charge copy 1, 2 icons) → reveal Charge copy 2 (attaches; its own forced interrupt only matters
 *   on a *later* attack this round, and there isn't one, so it just sits there — no threat, so again +1
 *   acceleration only).
 *
 * Total: 2 + 2 + 1 + 1 = 6 of the target 7, landing exactly on the boundary at round 5 with no round ever reaching
 * or passing 7 along the way.
 *
 * **Readying, not just health.** RRG 1.8 "End of Player Phase" readies every exhausted card *before* the villain
 * phase (p. 14 step 3), not at the start of the next round — so a hero who defends every villain phase enters their
 * *own* next turn still exhausted (readying only for the villain phase they are about to defend again), and never
 * gets `basicThwart` back. The fixture's play-forward therefore defends Rhino's first three attacks with Spider-Man
 * (all safely absorbed: Rhino's ATK never exceeds his DEF 3 until Enhanced Ivory Horn's permanent +1 lands in round
 * 3) and *declines* the fourth, so Spider-Man is ready — not exhausted — for round 5's own turn. That fourth attack
 * lands undefended (base ATK 2 + Enhanced Ivory Horn's +1 + Charge's 2 boost icons = 5), which Spider-Man's 10 HP
 * shrugs off with room to spare.
 */
export const HOLDON_SCHEME_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  modularSetIds: ["bomb_scare"],
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 9001,
  stack: {
    encounter: [
      cardId("01098"), // r1 step-2 attack boost (Armored Rhino Suit, 0 icons)
      cardId("01186"), // r1 step-3 reveal: Advance — "the villain schemes" draws its own extra boost card
      cardId("01104"), // Advance's own scheme-activation boost (Hard to Keep Down copy 1, 0 icons)
      cardId("01104"), // r2 step-2 attack boost (Hard to Keep Down copy 2, 0 icons)
      cardId("01186"), // r2 step-3 reveal: Advance again — its own extra boost card
      cardId("01105"), // Advance's own scheme-activation boost ("I'm Tough!" copy 1, 0 icons)
      cardId("01105"), // r3 step-2 attack boost ("I'm Tough!" copy 2, 0 icons)
      cardId("01100"), // r3 step-3 reveal: Enhanced Ivory Horn (attaches, +1 ATK permanent, no threat, no surge)
      cardId("01099"), // r4 step-2 attack boost (Charge copy 1, 2 icons)
      cardId("01099"), // r4 step-3 reveal: Charge copy 2 (attaches, no threat, no attack left this round to boost)
    ],
  },
};

/**
 * The `lethal` fixture (`view/guide-hints.ts`'s `lethalHint`): a solo Rhino game (Spider-Man, Justice, seed 7 —
 * traced by running the real scenario forward with no state edits) where, by round 3, Spider-Man has taken every
 * Rhino attack undefended and one Hydra Bomber (the `bomb_scare` modular's own minion) is engaged with him — no
 * ally in play to help block. Ending the turn in hero form with Spider-Man at 1 of 10 HP, `lethalHint`'s best-block
 * math (villain ATK 2 + the engaged minion's ATK 1, Spider-Man himself blocking the larger of the two) still leaves
 * 1 unavoidable damage — exactly his remaining HP — so pressing End turn fires `lethalHint` ("Flip to alter-ego").
 *
 * No stack: the natural shuffle under this seed already reaches the boundary with a plain "flip to hero once, never
 * defend" play-forward, so nothing here needs to fight the same per-round card-order bookkeeping the scheme fixture
 * does.
 */
export const HOLDON_LETHAL_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 7,
};

/** Declines every choice except `declareDefender`, which defends with the hero for the first `defendLimit` attacks
 * and declines every attack after that (see `HOLDON_SCHEME_CONFIG`'s doc comment on why readying needs that). */
async function playForwardDeclining(
  store: SessionStore,
  defendLimit: number,
  stopWhenHintFires: (state: GameState, playerId: PlayerId) => boolean,
): Promise<void> {
  let flippedOnce = false;
  let defendCount = 0;
  for (let step = 0; step < 200; step++) {
    const game = store.state.game;
    if (!game || game.outcome) return;
    const actions = store.state.legal?.actions;
    if (!actions) return;

    if (actions.kind === "choice") {
      const prompt = game.pendingChoice?.prompt;
      if (prompt?.kind === "declareDefender") {
        defendCount++;
        const player = game.players.find((p) => p.playerId === store.state.perspectiveId);
        const heroId = player?.identity.instanceId;
        const opt = defendCount <= defendLimit ? actions.choice.options.find((o) => o.optionId === heroId) : undefined;
        await store.resolveChoice(opt ? [opt.optionId] : ["decline"]);
        continue;
      }
      await store.resolveChoice(actions.choice.options.slice(0, actions.choice.minSelections).map((o) => o.optionId));
      continue;
    }
    if (actions.kind !== "turn") return;

    const player = game.players.find((p) => p.playerId === store.state.perspectiveId);
    if (!player) return;

    if (!flippedOnce && player.identity.form === "alterEgo") {
      const flip = actions.legal.find((e) => e.action.kind === "changeForm");
      if (flip) {
        flippedOnce = true;
        await store.dispatch(flip.example);
        continue;
      }
    }

    if (stopWhenHintFires(game, player.playerId)) return; // leave the store here — the caller presses End turn.

    const end = actions.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

/** Starts `HOLDON_SCHEME_CONFIG` and plays it forward to the round-5 boundary (see the config's own doc comment). */
export async function startHoldOnSchemeGame(store: SessionStore): Promise<void> {
  await store.start(HOLDON_SCHEME_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]); // mulligan: keep the dealt hand.
  await playForwardDeclining(store, 3, (game, playerId) => {
    const actions = store.state.legal?.actions;
    const canThwart = actions?.kind === "turn" && actions.legal.some((e) => e.action.kind === "basicThwart");
    return canThwart && !!schemeFinishHint(game, POOL_DEPS, playerId);
  });
}

/** Starts `HOLDON_LETHAL_CONFIG` and plays it forward to its own boundary (see the config's own doc comment). */
export async function startHoldOnLethalGame(store: SessionStore): Promise<void> {
  await store.start(HOLDON_LETHAL_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]); // mulligan: keep the dealt hand.
  await playForwardDeclining(store, 0, (game, playerId) => !!lethalHint(game, POOL_DEPS, playerId));
}
