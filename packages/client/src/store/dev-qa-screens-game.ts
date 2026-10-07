/**
 * Real games stopped on the board one press before a prompt the wave 7 screens QA had not seen in a browser
 * (`docs/phase7-wave7-qa-screens.md`, `e2e/wave7-screens.spec.ts`), played forward through the store with
 * `SessionConfig.stack` and the engine's own example commands, never a state edit, so each replays byte for byte like
 * any saved game. `dev-qa-screens-game.test.ts` proves each reaches its state.
 *
 * - `restricted`: Deadpool in hero form with two 44052 (restricted upgrades) attached and a third in hand beside
 *   cards to pay for it: playing it asks "Discard to two restricted cards" (RRG 1.8 "Restricted", p. 38).
 * - `warpath`: Angel in hero form with Warpath (42013) in play and Ever Vigilant (42015) plus resource cards in hand,
 *   on his round 2 turn: ending the turn lets Rhino attack, Warpath defend, and his response play the event.
 * - `defenseLock`: Spider-Man (P1) and Deadpool (P2, Barely a Scratch in hand) on P1's round 2 turn: Rhino's attack on
 *   P1 comes with P1 defending, so P2's (defense) card must not be offered (owner ruling 2026-10-06, RRG pp. 14-15).
 * - `replacement`: Deadpool in hero form with a few hit points left on his own turn: the next hit would defeat him and
 *   The Regeneratin' Degenerate replaces that, a forced "would" with nothing for the player to order or click.
 */
import { WAVE7_STARTER_DECKS } from "@mc/content";
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn, type Turn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export type ScreensQaGame = "restricted" | "warpath" | "defenseLock" | "replacement";

const deck = (id: string) => WAVE7_STARTER_DECKS.find((candidate) => (candidate.id as string) === id)!;
const codesOf = (id: string): string[] =>
  deck(id).cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));
const DEADPOOL = deck("deadpool-pool");
const deadpool = (codes: readonly string[]) => ({
  identityCardId: DEADPOOL.identityCardId as string,
  deck: [...codes],
  aspects: ["pool" as const],
});
/** The 'Pool precon with its first copy of `from` turned into `to`. */
const swapped = (from: string, to: string): string[] => {
  const codes = codesOf("deadpool-pool");
  codes[codes.indexOf(from)] = to;
  return codes;
};

/** Deadpool's Katana (44010, x2 in the precon) and Bazooka (44052, swapped in for one 44017): three restricted cards. */
export const KATANA = "44010";
/** A seed where Deadpool is down to 1 hit point of 9 on round 2 and the next hit does not also end the game. */
export const REPLACEMENT_SEED = 5;
export const RESTRICTED = "44052";
export const WARPATH = "42013";
export const EVER_VIGILANT = "42015";
export const BARELY_A_SCRATCH = "44017";

/** The configs, exported so the Vitest check and the spec read the same cards. */
export function screensQaConfig(which: ScreensQaGame): SessionConfig {
  switch (which) {
    case "restricted":
      return {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [deadpool(swapped("44017", RESTRICTED))],
        seed: 3,
        // Two Katanas and the Bazooka up front (each costs 2), then cards that pay for them: the Katanas are played in
        // rounds 1 and 2, and the Bazooka waits in hand on round 2 with its payment drawn.
        stack: {
          players: { 0: ids(KATANA, KATANA, RESTRICTED, "44004", "44004", "44006", "44006", "44003", "44005") },
        },
      };
    case "warpath":
      return {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ starterDeckId: "angel-protection" }],
        seed: 3,
        stack: {
          players: {
            0: ids(WARPATH, "42003", "42003", "42004", "42004", EVER_VIGILANT, "42005", "42005", "42006", "42006"),
          },
        },
      };
    case "defenseLock":
      return {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ starterDeckId: "core-spider-man-justice" }, deadpool(codesOf("deadpool-pool"))],
        seed: 3,
        stack: { players: { 1: ids(BARELY_A_SCRATCH, BARELY_A_SCRATCH) } },
      };
    case "replacement":
      return {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [deadpool(codesOf("deadpool-pool"))],
        seed: REPLACEMENT_SEED,
      };
  }
}

const seat = (game: GameState, store: SessionStore) =>
  game.players.find((player) => player.playerId === store.state.legal?.playerId);

const legalPlay = (turn: Turn, game: GameState, code: string) =>
  turn.legal.find((entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === code);

/** The damage on a seat's identity card (Deadpool's hit points are 9). */
const damageOn = (game: GameState, playerIndex: number): number =>
  game.instances[game.players[playerIndex]!.identity.instanceId]?.damage ?? 0;

/** Starts the game and plays it forward until the stop described at the top of this file. */
export async function startScreensQaGame(store: SessionStore, which: ScreensQaGame): Promise<void> {
  await store.start(screensQaConfig(which));
  for (let step = 0; step < 60; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const active = seat(game, store);
    const index = game.players.findIndex((player) => player === active);
    const flip = () => turn.legal.find((entry) => entry.action.kind === "changeForm");
    const end = () => turn.legal.find((entry) => entry.action.kind === "endTurn");
    // The engine's example payment spends the first hand cards it finds, which could be the very cards the stop needs:
    // pay with hand cards that are none of them instead.
    const KEEP = [KATANA, RESTRICTED, WARPATH, EVER_VIGILANT];
    const playPaying = async (code: string): Promise<boolean> => {
      const entry = legalPlay(turn, game, code);
      if (!entry || entry.example.type !== "playCard") return false;
      const others = me.hand.filter((id) => !KEEP.includes(codeOf(game, id)));
      // Cards print one or two resources: add payers until the engine accepts the payment.
      for (let count = 1; count <= others.length; count++) {
        await store.dispatch({ ...entry.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) return true;
      }
      return false;
    };
    const act = async (
      entry: { example: Parameters<SessionStore["dispatch"]>[0] } | undefined | null,
    ): Promise<boolean> => {
      if (!entry) return false;
      await store.dispatch(entry.example);
      return true;
    };
    const me = active!;
    const inHand = (code: string) => me.hand.filter((id) => codeOf(game, id) === code).length;
    const attached = me.identity.instanceId
      ? (game.instances[me.identity.instanceId]?.attachments ?? []).filter((id) => codeOf(game, id) === KATANA).length
      : 0;

    if (which === "restricted") {
      if (me.identity.form === "alterEgo" && (await act(flip()))) continue;
      // Stop with two attached, a third held, and at least two other cards to pay with.
      if (attached >= 2 && inHand(RESTRICTED) >= 1 && me.hand.length >= 3) return;
      if (attached < 2 && (await playPaying(KATANA))) continue;
    } else if (which === "warpath") {
      if (me.identity.form === "alterEgo" && (await act(flip()))) continue;
      if (game.round >= 2 && inHand(EVER_VIGILANT) >= 1 && me.playArea.some((id) => codeOf(game, id) === WARPATH))
        return;
      if (!me.playArea.some((id) => codeOf(game, id) === WARPATH) && (await playPaying(WARPATH))) continue;
    } else if (which === "defenseLock") {
      if (me.identity.form === "alterEgo" && (await act(flip()))) continue;
      if (game.round >= 2 && index === 0) return;
    } else {
      if (me.identity.form === "alterEgo" && (await act(flip()))) continue;
      if (damageOn(game, 0) >= 7) return;
    }
    if (!(await act(end()))) return;
  }
}
