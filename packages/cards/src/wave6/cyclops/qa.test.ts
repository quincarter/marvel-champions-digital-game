import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { cyclopsGame } from "./cyclops/support.js";

/**
 * Wave 6 rules QA, Cyclops (`docs/phase7-wave6-qa-cyclops-phoenix.md`). Two parts.
 *
 * 1. Rulings that touch a Cyclops card. Already pinned exactly by a module test, so not copied here:
 *    - FAQ "Ricochet Beam (#9)" (RRG 1.8 p. 64, "Exploit Weakness increases each instance of damage ... 8 damage"):
 *      `cyclops/events.test.ts` "FAQ #9: Exploit Weakness adds 1 to each instance, 8 total on the same enemy", and the
 *      same 4 + 8 through `sessionApply` in `cyclops/e2e.test.ts` "scripted: Exploit Weakness, Optic Blast and Ricochet
 *      Beam ...".
 *    - Ruling Feb 8, 2026 (1), Coordinated Attack ("Designer Intent: ... an attack defeating the minion still reduces
 *      consequential damage"; rules as written say otherwise, FFG intends the former, Q50): `cyclops/
 *      support-upgrades-allies.test.ts` "an attack that defeats the attached minion still takes 1 less consequential
 *      damage" (and the three controls around it).
 *    - RRG 1.8 "Temporary" (p. 44), Exploit Weakness only: `cyclops/e2e.test.ts` (discarded at round end). The other two
 *      Temporary tactics are asserted below.
 *    - Ruling Jan 26, 2026 (3), Marked, the half where excess damage is dealt and taken: `cyclops/support-upgrades-allies
 *      .test.ts` "Marked (33032)" (the 1 excess goes to the villain). The half where it is dealt but not taken is below.
 *    No erratum on p. 65 to 69 names a Cyclops card, and no other post-1.7 ruling names one (greps of the RRG and the
 *    rulings file for the hero, his nemesis set and every card title in the pack).
 * 2. Whole games with Cyclops's precon, 2 players standard (with Phoenix, the other wave 6 hero whose pack shares
 *    Psychic Rapport) and 1 hero expert, played by the greedy driver and replayed deep-equal.
 */

const alterEgo = (): GameState => cyclopsGame("rhino");
const hero = (): GameState => withForm(alterEgo(), { heroForm: 0 });

/** Takes the card out of whichever zone holds it and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

describe("rulings", () => {
  describe("RRG 1.8 'Temporary' (p. 44): the three Temporary tactic upgrades", () => {
    // Exploit Weakness 33005, Practiced Defense 33006, Priority Target 33007 all print "Temporary". The e2e test pins
    // Exploit Weakness alone; here all three sit on the villain together and leave at the same round end.
    it("are all discarded from play at the end of the round, to their owner's discard pile", () => {
      let state = alterEgo();
      const villain = activeVillain(state).instanceId;
      const attached: InstanceId[] = [];
      for (const code of ["33005", "33006", "33007"]) {
        const result = attachFromHand(state, code, villain);
        state = result.state;
        attached.push(result.id);
      }
      expect(inst(state, villain).attachments).toEqual(expect.arrayContaining(attached));
      const after = settle(runWith(WAVE6_DEPS, state, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      expect(after.round).toBe(2);
      for (const id of attached) {
        expect(inst(after, villain).attachments).not.toContain(id);
        expect(playerOf(after, P1).discard).toContain(id);
      }
    });
  });

  describe("Ruling Jan 26, 2026 (3): overkill counts damage taken, not dealt (Marked, 33032)", () => {
    // "If Nimrod had Marked attached, Nimrod took only 3 damage (less than his 4 HP), so 0 excess damage was taken,
    // resulting in no overkill damage dealt to the villain." Staged with a tough status card instead of Nimrod's
    // reduction: the attack deals damage past the minion's last hit point, the minion takes none of it.
    const markedAttack = (tough: boolean) => {
      const base = hero();
      const { state: engaged, id: minion } = engageMinion(base, "01101", P1);
      const last = playerOf(engaged, P1).deck.at(-1)!;
      const withMarked = patchInstance(engaged, last, { cardId: cardId("33032") });
      // Cyclops's own ATK is 1, so Exploit Weakness (+1 damage) lets the attack reach past the last hit point.
      const { state: marked } = attachFromHand(withMarked, "33032", minion);
      const { state: armed } = attachFromHand(marked, "33005", minion);
      const hp = 3;
      const staged = patchInstance(armed, minion, {
        damage: hp - 1,
        statuses: { ...inst(armed, minion).statuses, tough: tough ? 1 : 0 },
      });
      const after = settle(
        runWith(WAVE6_DEPS, staged, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(staged, P1),
          targetInstanceId: minion,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { after, minion, villain: activeVillain(after).instanceId };
    };

    it("control: with no tough card the minion takes the excess and the villain takes the overkill", () => {
      const { after, minion, villain } = markedAttack(false);
      expect(cardsInPlay(after)).not.toContain(minion); // defeated
      expect(inst(after, villain).damage).toBeGreaterThan(0);
    });

    it("a tough card absorbs the attack: no damage taken, so no overkill reaches the villain", () => {
      const { after, minion, villain } = markedAttack(true);
      expect(inst(after, minion).statuses.tough).toBe(0);
      expect(inst(after, minion).damage).toBe(2);
      expect(inst(after, villain).damage).toBe(0);
    });
  });
});

const DUO = [{ starterDeckId: "cyclops-leadership" }, { starterDeckId: "phoenix-justice" }] as const;
const SOLO = [{ starterDeckId: "cyclops-leadership" }] as const;

const TACTICS = ["33005", "33006", "33007"]; // Exploit Weakness, Practiced Defense, Priority Target (Temporary)
const OPTIC_BLAST = "33001a.cyclops-constant";

const eventsOf = (result: DriverResult): readonly GameEvent[] => {
  const again = replay(result.session.log, WAVE6_DEPS);
  expect(again.ok).toBe(true);
  if (!again.ok) throw new Error("replay failed");
  expect(again.state).toEqual(result.session.state);
  return again.events;
};

const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Phoenix)", options: { players: DUO } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];

describe.each(VARIANTS)("Cyclops vs Rhino ($label)", ({ options }) => {
  it("plays to an outcome and replays deep-equal, with his tactics, Optic Blast and an ally in the game", () => {
    // The signature mechanic as scripted: a Temporary tactic upgrade played onto an enemy, Optic Blast used (it needs an
    // enemy with an upgrade attached), and one of his (or the aspect's) allies played. Seeds are the first match of a
    // fixed range, so a run always finds the same game. Played from setup, no surgery.
    let found: { result: DriverResult; events: readonly GameEvent[] } | null = null;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const created = createGame(wave6Scenario("rhino", { ...options, seed }), WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, WAVE6_DEPS);
      if (!result.outcome) continue;
      const played = replay(result.session.log, WAVE6_DEPS);
      if (!played.ok) throw new Error("replay failed");
      const cards = played.events.flatMap((e) => (e.type === "cardPlayed" ? [e.cardId as string] : []));
      const abilities = played.events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
      const state = result.session.state;
      const allyPlayed = cards.some((c) => state.cardPool[cardId(c)]?.type === "ally");
      if (cards.some((c) => TACTICS.includes(c)) && abilities.includes(OPTIC_BLAST) && allyPlayed)
        found = { result, events: played.events };
    }
    if (!found) throw new Error("no seed of 1..40 played a tactic, Optic Blast and an ally");
    expect(found.result.outcome).not.toBeNull();
    expect(eventsOf(found.result)).toEqual(found.events);
  }, 600_000);
});
