/**
 * Rules audit chunk 05 (Glossary: CLASSIFICATIONS ... DEFEAT). Audit proofs only: each `it.fails` marks a place the
 * engine does something an official source forbids, and flips to a failure when it is fixed.
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { activeEncounterDeck, remainingHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, identityOf, inst, instancesOf, mainThreat, patchInstance } from "../testing/harness.js";
import { conjure, drive, intoPlay, playOut, rhino, withPatrolMinion } from "../testing/qa-bench.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { attachToHost } from "../wave6/mut_gen/project-wideawake-testing.js";
import { magnetoGame } from "../wave6/mut_gen/magneto-testing.js";
import { endTurn, firstLegal, runWith, settle, stackEncounterDeck, toHero } from "../testing/harness.js";
import { encounterSetId } from "@mc/content";
import { ghostSpiderScenario } from "../wave5/sm/ghost-spider/support.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../wave5/testing.js";

const IRON_FIST = "09014";
const DEFENDER = "06003";
const SENTINEL = "32093";

describe("Consequential damage when the basic attack's target leaves play (RRG 1.8 'Consequential Damage', p. 13)", () => {
  it("Iron Fist's interrupt defeats the attacked minion: the attack aborts and he takes no consequential damage", () => {
    const withMinion = withPatrolMinion(rhino());
    const minion = withMinion.players
      .find((p) => p.playerId === P1)!
      .playArea.find((id) => withMinion.instances[id]!.engagedWith === P1)!;
    const placed = intoPlay(withMinion, IRON_FIST, { mystic: 2 });
    const fist: InstanceId = placed.id;
    // One hit point left: the interrupt's 1 damage defeats the minion before the basic attack deals any.
    const hp = remainingHitPoints(placed.state, minion)!;
    const staged = patchInstance(placed.state, minion, { damage: inst(placed.state, minion).damage + hp - 1 });
    const done = drive(
      staged,
      { type: "basicAttack", playerId: P1, attackerInstanceId: fist, targetInstanceId: minion },
      { use: ["iron-fist-interrupt"] },
    );
    expect(done.accepted).toBe(true);
    // Staging sanity: the interrupt was used, the minion is gone and Iron Fist exhausted.
    expect(inst(done.state, fist).counters.mystic).toBe(1);
    expect(done.state.players.find((q) => q.playerId === P1)!.playArea).not.toContain(minion);
    expect(inst(done.state, fist).exhausted).toBe(true);
    // The RRG's own example: no consequential damage. Actual: 1.
    expect(inst(done.state, fist).damage).toBe(0);
  });
});

describe("Cost arrow with a confused hero (FFG ruling April 30, 2026 (2); RRG 1.8 'Confuse' p. 13, 'Cost Arrow Icon' p. 13)", () => {
  it("Defender of the Nine Realms (06003) played while confused: the minion (cost) still comes, the confused card replaces the thwart", () => {
    const base = rhino();
    const me = identityOf(base);
    // Two Sentinel Mark IV minions on top of the encounter deck for the "discard until a minion" cost.
    const sentinel = PLAYABLE_CARDS.find((card) => card.id === cardId(SENTINEL))!;
    let staged: GameState = { ...base, cardPool: { ...base.cardPool, [sentinel.id]: sentinel } };
    for (const id of activeEncounterDeck(base).deck.slice(0, 2))
      staged = patchInstance(staged, id, { cardId: sentinel.id });
    staged = patchInstance(staged, me, { statuses: { ...inst(staged, me).statuses, confused: 1 } });
    const given = conjure(staged, DEFENDER);
    const threatBefore = mainThreat(given.state);
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(true);
    // The confused card replaced the thwart (this half is right today) and no threat came off.
    expect(inst(done.state, me).statuses.confused).toBe(0);
    expect(mainThreat(done.state)).toBe(threatBefore);
    // The cost (before the arrow) was paid: a minion is engaged with the player. Actual: none.
    const engaged = instancesOf(done.state, SENTINEL).filter((id) => inst(done.state, id).engagedWith === P1);
    expect(engaged.length).toBe(1);
  });
});

/*
 * FFG ruling February 15, 2024 - Ruling 145 (post-RRG 1.5; Hall of Heroes, "Latest FFG Rulings (post-RRG 1.5)",
 * https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/):
 * "If a Steady Magneto has 1 confused status card on him when Magneto's Helmet attaches to him, the confused status
 * card remains on him unless he gains Stalwart." RRG 1.8 agrees: "Confuse, Confused" (p. 13) says only that
 * "confused status cards cannot be placed on that character", and "Status Cards" (p. 41) lists no rule that removes a
 * status card already held.
 */
describe("'Cannot be confused' stops new status cards only (FFG ruling Feb 15, 2024 #145; RRG 1.8 'Confuse', p. 13)", () => {
  it.fails("Magneto's Helmet (32147) attaching to a confused Magneto leaves the confused status card on him", () => {
    const base = runWith(WAVE6_DEPS, magnetoGame(), toHero(P1));
    const magneto = base.activeVillainId!;
    const confused = patchInstance(base, magneto, { statuses: { ...inst(base, magneto).statuses, confused: 1 } });
    const armed = attachToHost(confused, "32147", magneto).state;
    // Any command runs the state checks; a player's basic attack does not touch the villain's confused card.
    const identity = identityOf(armed);
    const after = runWith(WAVE6_DEPS, patchInstance(armed, identity, { exhausted: false }), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: magneto,
    });
    expect(inst(after, magneto).statuses.confused).toBe(1);
  });
});

/*
 * Conflict inside RRG 1.8 itself. "Damage" (p. 14) orders the dealing and taking of damage as "1. Abilities that
 * trigger 'when [character] would deal/be dealt any amount of damage...' 2. Tough status cards. 3. Abilities that
 * trigger 'when [character] would take any amount of damage...'". The Appendix IV FAQ (p. 57) says instead: "Status
 * cards have priority over all triggered abilities, like interrupts, so the tough status card must be discarded to
 * prevent all of the damage before any other abilities could trigger" (and "Status Cards", p. 41: "Status card
 * abilities have timing priority over all conflicting triggered abilities"). FFG rulings July 20, 2023 - Rulings 55
 * and 56 (post-RRG 1.5; https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/) side with p. 14: "Interrupts that prevent damage dealt
 * resolve before Tough is discarded". They predate v1.8, and v1.8 still prints both texts, so the conflict stays open.
 * The engine follows p. 14 (upstream #181, audit finding 17), and this test pins that behaviour.
 */
describe("Damage order, step 1 before step 2 (RRG 1.8 'Damage', p. 14; conflicts with the Appendix IV FAQ, p. 57)", () => {
  // Fixed upstream in #181, audit finding 17 (wouldBeDealt: "would be dealt", then tough, then "would be taken").
  it("a 'would be dealt damage' forced interrupt (Bell Tower, Ringing) resolves before the hero's Tough status card is used", () => {
    const state = startWave5Game(
      ghostSpiderScenario("venom", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }),
    );
    const identity = identityOf(state);
    const tower = instancesOf(state, "27077a")[0] ?? instancesOf(state, "27077b")[0]!;
    // Ringing with 5 chime counters; the hero holds a Tough status card; Venom's activation attacks (2 ATK, 0-icon boost).
    const ringing = patchInstance(patchInstance(state, tower, { flipped: true, counters: { chime: 5 } }), identity, {
      statuses: { ...inst(state, identity).statuses, tough: 1 },
    });
    const stacked = stackEncounterDeck(ringing, "01186");
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Step 1: the interrupt removes 2 chime counters and prevents all of the damage dealt, so Tough is never needed.
    expect(inst(after, tower).counters["chime"]).toBe(3);
    expect(inst(after, identity).statuses.tough).toBe(1);
  });
});
