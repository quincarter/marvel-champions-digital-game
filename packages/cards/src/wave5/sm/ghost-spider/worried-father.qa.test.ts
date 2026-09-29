import { cardsInPlay, characterProfile } from "@mc/engine";
import { expect, test } from "vitest";
import { identityOf, instancesOf, P1, patchInstance, stackEncounterDeck, toHero } from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "./support.js";

const ADVANCE = "01186";
const WORRIED_FATHER = "27025";

/**
 * Rules QA follow-up to the Ghost-Spider e2e agent's report: a full greedy-driver game against Rhino
 * (`ghost-spider/e2e.test.ts`, solo, ran to a loss in round 7) ended with Worried Father (27025) in the
 * *encounter* discard pile, not still in play and not `removedFromGame`. This pins down why, and shows it is
 * correct engine behavior, not a bug in `obligation-nemesis.ts` or a stray "discard after resolving" path.
 *
 * Worried Father's own text never sends it anywhere except: (a) into the Gwen Stacy player's play area on reveal
 * (RRG 1.8 "Obligation", p. 30: "place that obligation into the player's play area"), where it is meant to sit
 * until (b) its own Alter-Ego Action removes it from the game. There is no "discard this obligation" text on the
 * card and no generic "obligations discard after resolving" rule — RRG 1.8 "Obligation" (p. 30) says only that the
 * owning player "must decide how to resolve the obligation"; it does not say when or whether it ever leaves play
 * on its own. So an obligation sitting untouched in a player's play area for the rest of the game is expected,
 * and the only path that should ever move Worried Father is its own Alter-Ego Action (→ `removedFromGame`) — or,
 * this test's subject, the identity that carries it being defeated and eliminated from the game entirely.
 *
 * A "loss in round 7" against Rhino is very likely Ghost-Spider's own identity taking lethal damage. **RRG 1.8
 * "Player Elimination" (p. 34), step 3**, governs every card left in that player's play area at that moment that
 * is "not owned by that player": an attachment with the permanent keyword resolves its "attach to" text or is
 * removed from the game if it can't; every other non-attachment permanent card is removed from the game; *"Place
 * each other card in its owner's discard pile."* Worried Father is an encounter card (no `ownerId`, no
 * `permanent` keyword — `packages/content/src/data/sm/cards.ts`'s own `keywords: []`), so it falls to that third
 * bullet, and "its owner's discard pile" for a card with no player owner is its own encounter deck's discard pile
 * — the same convention `discardZoneFor` already documents for every other ownerless encounter card leaving play
 * (`packages/engine/src/query.ts`). `eliminatePlayer` (`packages/engine/src/resolve/defeat.ts`) implements exactly
 * this: a card in the eliminated player's `playArea` that is not a re-engaging minion and not a not-owned
 * permanent card is moved with `discardZoneFor`, which resolves an encounter-homed instance to its
 * `encounterDiscard` zone. So Worried Father landing in the encounter discard pile after the identity carrying it
 * is defeated is the documented cleanup step working as designed, not a leftover "obligation resolved, discard it"
 * path misapplied to a card that should have stayed in play, and not a leave-play effect on its own facedown
 * attachment (George Stacy, if still attached, is caught by the very same step 3 sweep over the identity's own
 * `attachments`/host's attachments, not by anything specific to Worried Father).
 *
 * This is deliberately *not* `it.fails`: the observed final location is correct per RRG 1.8 p. 34 step 3, so this
 * test pins the real (and right) behavior instead of a bug.
 */
test("Worried Father goes to the encounter discard pile — not `removedFromGame`, not left in play — when the identity carrying it is eliminated (RRG 1.8 'Player Elimination', p. 34, step 3)", () => {
  const base = startWave5Game(ghostSpiderScenario("rhino", { seed: 4 }));
  // Round 1: Worried Father dealt and resolved (George Stacy searched and attached facedown) — the same shape as
  // `obligation-nemesis.test.ts`'s own first two tests, just carried on to the identity's own elimination.
  const initial = stackEncounterDeck(base, ADVANCE, WORRIED_FATHER);
  const { state: revealed } = driveEvents(WAVE5_DEPS, initial, toHero(P1), { type: "endTurn", playerId: P1 });
  const [obligation] = instancesOf(revealed, WORRIED_FATHER);
  expect(obligation).toBeDefined();
  expect(cardsInPlay(revealed)).toContain(obligation); // Still exactly where its reveal put it — nothing has moved it yet.

  // Prime Ghost-Spider's own identity one hit from defeat, then let Rhino's own villain-phase attack land the
  // killing blow through the engine's real defeat/elimination pipeline (`defeatWithAttack`'s own pattern, but via
  // a real villain-phase attack rather than a scripted `basicAttack`, matching how the e2e game actually lost).
  const identity = identityOf(revealed, P1);
  const profile = characterProfile(revealed, identity, WAVE5_DEPS)!;
  const primed = patchInstance(revealed, identity, { damage: profile.maxHp - 1 });
  const { state: after } = driveEvents(WAVE5_DEPS, primed, { type: "endTurn", playerId: P1 });

  expect(after.players.find((p) => p.playerId === P1)?.eliminated).toBe(true);
  expect(after.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });

  // Worried Father: not still in play, not removed from the game (its Alter-Ego Action never fired) — in the
  // encounter discard pile, per RRG 1.8 p. 34 step 3's "place each other card in its owner's discard pile".
  expect(cardsInPlay(after)).not.toContain(obligation);
  expect(after.removedFromGame).not.toContain(obligation);
  const deckId = Object.keys(after.encounterDecks)[0]!;
  expect(after.encounterDecks[deckId]!.discard).toContain(obligation);
});
