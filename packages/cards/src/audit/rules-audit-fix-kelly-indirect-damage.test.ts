/**
 * Rules audit fix `kelly-indirect-damage` (findings/chunk-42.md 42.13). FFG Game Rules Specialist (Alex), July 11,
 * 2024, "Latest FFG Rulings post RRG 1.5" ruling 221: "Robert Kelly's ability forces you to deal all damage from an
 * undefended attack to Robert Kelly, even if that enemy attack deals indirect damage." RRG 1.8 "Indirect Damage"
 * (p. 24) lets the player divide an attack's indirect damage among their characters; Kelly's Forced Interrupt (32066),
 * at the attack's damage step (`enemyAttackDamageStep`, upstream #181), takes all of an undefended attack's damage before
 * any share is assigned, so the player is not asked to assign it. The pickers below would split it if asked.
 *
 * Staging: the Sabretooth scenario with the Menagerie Medley modular, past Find the Senator (Robert Kelly detached,
 * controlled by player one), with Starshark (16137, "Starshark's attacks deal indirect damage") engaged with player one
 * and Black Cat (01002) in play, so the player has an ally to assign Starshark's damage to.
 */
import { type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, playFromHand } from "../testing/staging.js";
import { WAVE6_DEPS as DEPS } from "../wave6/index.js";
import { engageMinion } from "../wave6/mut_gen/project-wideawake-testing.js";
import { kellyOf, sabretoothGame, senatorOf } from "../wave6/mut_gen/sabretooth-testing.js";

vi.setConfig({ testTimeout: 120_000 });

const BLACK_CAT = "01002";
const STARSHARK = "16137";
/**
 * Sabretooth's boost card (no icons), the card his Forced Response discards, Starshark's boost card (no icons), then a
 * reveal that does nothing.
 */
const FILLER = ["01186", "01187", "01188", "32071"] as const;

/** Find the Senator defeated (Kelly detached, controlled by player one), hero form, Starshark engaged, Black Cat in play. */
function staged(): { state: GameState; cat: InstanceId; shark: InstanceId } {
  const game = engageMinion(sabretoothGame({ modularSetIds: ["menagerie_medley"] }), STARSHARK);
  const hero = settle(runWith(DEPS, game.state, toHero(P1)), firstLegal, undefined, DEPS);
  const ready = patchInstance(hero, senatorOf(hero), { threat: 1 });
  const thwarted = settle(
    runWith(DEPS, ready, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(ready),
      schemeInstanceId: senatorOf(ready),
    }),
    firstLegal,
    undefined,
    DEPS,
  );
  const deckId = Object.keys(thwarted.encounterDecks)[0]!;
  const pile = thwarted.encounterDecks[deckId]!;
  const dealt = thwarted.players.flatMap((p) => p.dealtEncounter);
  const cleared: GameState = {
    ...thwarted,
    players: thwarted.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...thwarted.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...dealt] } },
  };
  const { state, id } = playFromHand(DEPS, cleared, BLACK_CAT, 2);
  return { state, cat: id, shark: game.id };
}

/** Declines to defend, and assigns the attack's indirect damage per `split` (one id per point of `amount`). */
const assigning =
  (split: (state: GameState, amount: number) => readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return ["decline"];
    if (choice?.prompt.kind === "assignIndirectDamage") {
      const counts = new Map<InstanceId, number>();
      return split(state, choice.prompt.amount).map((id) => {
        const n = (counts.get(id) ?? 0) + 1;
        counts.set(id, n);
        return `${id}#${n}`;
      });
    }
    return firstLegal(state);
  };

/** The damage Starshark's attack dealt (its ATK and boost icons). */
const sharkDamage = (events: readonly GameEvent[], shark: InstanceId): number => {
  const attack = events.find((e) => e.type === "attackResolved" && e.enemyInstanceId === shark);
  if (attack?.type !== "attackResolved") throw new Error("Starshark did not attack");
  return attack.damageDealt;
};
/** The damage Sabretooth's attack dealt (undefended, already redirected to Kelly before this fix). */
const villainDamage = (events: readonly GameEvent[], shark: InstanceId): number =>
  events
    .filter((e) => e.type === "attackResolved" && e.enemyInstanceId !== shark)
    .reduce((sum, e) => sum + (e.type === "attackResolved" ? e.damageDealt : 0), 0);

const villainPhase = (state: GameState, pick: Picker) =>
  driveEventsPicking(DEPS, stackEncounterDeck(state, ...FILLER), pick, { type: "endTurn", playerId: P1 });

describe("Robert Kelly (32066) and an undefended attack that deals indirect damage (ruling 221, Jul 11, 2024)", () => {
  it("staging: Kelly and Black Cat are player one's, and Kelly takes the undefended attack before any assignment", () => {
    const { state, cat, shark } = staged();
    expect(inst(state, shark).controllerId).toBeNull();
    expect(inst(state, kellyOf(state)).controllerId).toBe(P1);
    expect(inst(state, cat).controllerId).toBe(P1);
    let asked = false;
    const { events } = villainPhase(state, (s) => {
      if (s.pendingChoice?.prompt.kind === "assignIndirectDamage") asked = true;
      return assigning((s2, amount) => [cat, ...Array.from({ length: amount - 1 }, () => identityOf(s2))])(s);
    });
    expect(sharkDamage(events, shark)).toBe(3);
    expect(asked).toBe(false);
  });

  it("all of it goes to Robert Kelly when the player assigns as much as it can take to an ally", () => {
    const { state: before, cat, shark } = staged();
    const { state, events } = villainPhase(
      before,
      assigning((s, amount) => [cat, cat, ...Array.from({ length: amount - 2 }, () => identityOf(s))]),
    );
    expect(inst(state, cat).damage).toBe(0);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(sharkDamage(events, shark)).toBe(3);
    expect(inst(state, kellyOf(state)).damage).toBe(villainDamage(events, shark) + 3);
  });

  it("all of it goes to Robert Kelly when the player splits it between the identity and an ally", () => {
    const { state: before, cat, shark } = staged();
    const { state, events } = villainPhase(
      before,
      assigning((s, amount) => [identityOf(s), ...Array.from({ length: amount - 1 }, () => cat)]),
    );
    expect(inst(state, cat).damage).toBe(0);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(sharkDamage(events, shark)).toBe(3);
    expect(inst(state, kellyOf(state)).damage).toBe(villainDamage(events, shark) + 3);
    // Still Starshark's damage: "Robert Kelly took 3 damage from Starshark".
    const fromShark = events.filter(
      (e) => e.type === "damageDealt" && e.targetInstanceId === kellyOf(state) && e.sourceInstanceId === shark,
    );
    expect(fromShark.reduce((sum, e) => sum + (e.type === "damageDealt" ? e.amount : 0), 0)).toBe(3);
  });

  it("a share the player assigns to Robert Kelly himself is not redirected again", () => {
    const { state: before, shark } = staged();
    const { state, events } = villainPhase(
      before,
      assigning((s, amount) => Array.from({ length: amount }, () => kellyOf(s))),
    );
    expect(inst(state, kellyOf(state)).damage).toBe(villainDamage(events, shark) + sharkDamage(events, shark));
  });
});
