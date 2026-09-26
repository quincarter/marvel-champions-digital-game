import { createGame, replay } from "@mc/engine";
import { DRAX_STARTER_DECKS, GAM_STARTER_DECKS, VNM_STARTER_DECKS, type CardId, type StarterDeck } from "@mc/content";
import { playToOutcome } from "../../testing/driver.js";
import type { CorePlayer } from "../../core/setup.js";
import { WAVE3_DEPS } from "../index.js";
import { wave3Scenario } from "../setup.js";

/**
 * Coordinator ask (2026-09-26, "full rules QA" follow-up, item 4): every GMW scenario at 3 and 4 players, standard
 * and expert, run to a real completion with a deep-equal replay. Every earlier smoke game in this pack (checkpoints
 * 1-2, docs/phase7-wave3-qa.md) topped out at 2 players; this file adds one 3p-standard and one 4p-expert game per
 * scenario (the same shape `wave4/hood/three-four-player-e2e.test.ts` and `wave4/mts/three-four-player-e2e.test.ts`
 * use for their own boxes), seating all six wave 3 hero packs across the ten games so none of Star-Lord/Gamora/
 * Drax/Venom's own kits is left untested against a `gmw` villain at higher player counts either.
 */

function starterDeckPlayer(decks: readonly StarterDeck[], id: string): CorePlayer {
  const starter = decks.find((d) => (d.id as string) === id);
  if (!starter) throw new Error(`no starter deck ${id}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }: { cardId: CardId; quantity: number }) =>
      Array.from({ length: quantity }, () => cardId),
    ),
  };
}

const GAMORA_AGGRESSION = starterDeckPlayer(GAM_STARTER_DECKS, "gamora-aggression");
const DRAX_PROTECTION = starterDeckPlayer(DRAX_STARTER_DECKS, "drax-protection");
const VENOM_JUSTICE = starterDeckPlayer(VNM_STARTER_DECKS, "venom-justice");

function playGmw(label: string, scenarioId: string, players: number, seed: number, difficulty?: "expert") {
  const roster: readonly ({ readonly starterDeckId: string } | CorePlayer)[] = [
    { starterDeckId: "groot-protection" },
    { starterDeckId: "rocket-raccoon-aggression" },
    GAMORA_AGGRESSION,
    DRAX_PROTECTION,
  ];
  const config = wave3Scenario(scenarioId, {
    players: roster.slice(0, players),
    seed,
    ...(difficulty ? { difficulty } : {}),
  });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] ${label}: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

test("Brotherhood of Badoon (standard, 3p): Groot + Rocket Raccoon + Gamora", () => {
  playGmw("Brotherhood of Badoon (standard, 3p)", "brotherhood-of-badoon", 3, 5001);
}, 120_000);

test("Brotherhood of Badoon (expert, 4p): Groot + Rocket Raccoon + Gamora + Drax", () => {
  playGmw("Brotherhood of Badoon (expert, 4p)", "brotherhood-of-badoon", 4, 5002, "expert");
}, 180_000);

test("Infiltrate the Museum (standard, 3p): Groot + Rocket Raccoon + Gamora", () => {
  playGmw("Infiltrate the Museum (standard, 3p)", "infiltrate-the-museum", 3, 5003);
}, 120_000);

test("Infiltrate the Museum (expert, 4p): Groot + Rocket Raccoon + Gamora + Drax", () => {
  playGmw("Infiltrate the Museum (expert, 4p)", "infiltrate-the-museum", 4, 5004, "expert");
}, 180_000);

test("Escape the Museum (standard, 3p): Groot + Rocket Raccoon + Gamora", () => {
  playGmw("Escape the Museum (standard, 3p)", "escape-the-museum", 3, 5005);
}, 120_000);

test("Escape the Museum (expert, 4p): Groot + Rocket Raccoon + Gamora + Drax", () => {
  playGmw("Escape the Museum (expert, 4p)", "escape-the-museum", 4, 5006, "expert");
}, 180_000);

test("Nebula (standard, 3p): Groot + Rocket Raccoon + Gamora", () => {
  playGmw("Nebula (standard, 3p)", "nebula", 3, 5007);
}, 120_000);

test("Nebula (expert, 4p): Groot + Rocket Raccoon + Gamora + Drax", () => {
  playGmw("Nebula (expert, 4p)", "nebula", 4, 5008, "expert");
}, 180_000);

test("Ronan the Accuser (standard, 3p): Groot + Rocket Raccoon + Gamora", () => {
  playGmw("Ronan the Accuser (standard, 3p)", "ronan-the-accuser", 3, 5009);
}, 120_000);

test("Ronan the Accuser (expert, 4p): Groot + Rocket Raccoon + Gamora + Drax", () => {
  playGmw("Ronan the Accuser (expert, 4p)", "ronan-the-accuser", 4, 5010, "expert");
}, 180_000);

// Venom's own kit (VENOM_JUSTICE) doesn't have a natural home among the four-seat rosters above (every game already
// seats four of the six wave 3 heroes); one extra 4-player game folds it in rather than leaving it completely
// untested at 3p/4p against a `gmw` villain.
test("Nebula (standard, 4p): Groot + Rocket Raccoon + Gamora + Venom", () => {
  const config = wave3Scenario("nebula", {
    players: [
      { starterDeckId: "groot-protection" },
      { starterDeckId: "rocket-raccoon-aggression" },
      GAMORA_AGGRESSION,
      VENOM_JUSTICE,
    ],
    seed: 5011,
  });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Nebula (standard, 4p, Venom): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 180_000);
