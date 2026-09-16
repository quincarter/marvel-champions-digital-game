import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { wave1Scenario } from "../setup.js";
import { DRS_DEPS } from "./testing.js";

/**
 * A real game test for the `drs` pack (docs/phase7-wave1-scripting.md "Test conventions"): the Doctor Strange
 * (Protection) precon against Rhino, played headlessly by the same greedy driver `../../e2e.test.ts` uses for Core,
 * to a real win or loss — not just the individual-ability tests in `doctor-strange.test.ts`/`pack-cards.test.ts`/
 * `nemesis.test.ts`. This exercises `wave1Scenario`/`DRS_DEPS` end to end (setup, the Invocation deck dealt, a full
 * round and beyond) and replays the session log to a deep-equal final state.
 *
 * Uses `DRS_DEPS` (this pack's own local deps — see `./testing.ts`), not `../index.ts`'s `WAVE1_DEPS`: `drs` isn't
 * registered in `wave1/index.ts` yet (the main session adds that one line once this pack is done), so `WAVE1_DEPS`
 * doesn't know any Doctor Strange ability id yet.
 */
test("Rhino (standard, Bomb Scare), solo: Doctor Strange (Protection)", () => {
  // Seed 2026 no longer resolves any Invocation card once Desperate Defense (09015) is scripted: a new legal
  // Interrupt in the defense window shifts the greedy driver's RNG consumption enough that this particular seed's
  // playthrough (still a real, valid game) never happens to draw/use a Special this time. Reseeded to one that
  // does, keeping the "must resolve at least one Invocation card" coverage this test exists for.
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "drs-protection" }], seed: 2 });
  const created = createGame(config, DRS_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, DRS_DEPS);
  console.info(`[wave1 e2e] Rhino (standard) — Doctor Strange: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, DRS_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);

  // "Must resolve at least one Invocation card during the game" (docs/phase7-wave1-scripting.md's brief for this
  // pack): the Invocation deck/discard together always hold exactly 5 cards (Doctor Strange's own separate deck,
  // `HeroIdentityCard.separateDecks`); a card leaving the *deck* for anywhere other than the discard pile
  // (Open the Dark Dimension's own tuck, `nemesis.ts`) isn't possible outside a modular set not in play here, so any
  // non-empty Invocation discard pile is proof a Special was actually resolved (Spell Mastery, Master of the Mystic
  // Arts, or Natural Talent's own discard — all three move the top card off the deck one way or another).
  const strange = result.session.state.players[0]!;
  const invocation = strange.separateDecks["Invocation"];
  expect(invocation).toBeDefined();
  expect(invocation!.deck.length + invocation!.discard.length).toBe(5);
  expect(invocation!.discard.length).toBeGreaterThan(0);
}, 120_000);
