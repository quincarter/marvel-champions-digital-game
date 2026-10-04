import { cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardOf,
  maxHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, identityOf, patchInstance, playerOf, toHero, endTurn } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../testing.js";
import { ghostSpiderScenario } from "./ghost-spider/support.js";

/**
 * Regression for engine commit 65840174: an enemy attack reads an overkill granted by an attack-keyword rule
 * (`attacksGainKeywords(["overkill"], ...)`). RRG 1.8 "Overkill" (p. 31): when an enemy's attack with overkill
 * defeats ... excess damage dealt to a defending ally (or other non-identity character) is also dealt to the hero it
 * attacked. Each case: the ally defends at 1 remaining hit point, so it takes exactly 1 and the hero takes the rest
 * of the attack (ATK + boost icons, read from `attackResolved`); the control has no grant and the hero takes none.
 */

/** P1's first ally (hand or deck) put into play at 1 remaining hit point (test surgery). */
function withWoundedAlly(state: GameState, deps: EngineDeps): { readonly state: GameState; readonly ally: InstanceId } {
  const player = playerOf(state, P1);
  const ally = [...player.hand, ...player.deck].find((i) => cardOf(state, i)?.type === "ally");
  if (!ally) throw new Error("no ally in P1's hand or deck");
  const seated: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== ally),
            deck: p.deck.filter((i) => i !== ally),
            playArea: [...p.playArea, ally],
          }
        : p,
    ),
  };
  const hp = maxHitPoints(seated, ally, deps)!;
  return { state: patchInstance(seated, ally, { faceup: true, controllerId: P1, damage: hp - 1 }), ally };
}

/** A copy of `code` taken from the encounter deck or discard and engaged with P1 in P1's play area. */
function engage(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deck]!;
  const id = [...pile.deck, ...pile.discard].find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deck]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: P1 },
      },
    },
  };
}

/** P1 in hero form ends the turn; `ally` defends only against `attacker`'s attacks, the rest go undefended. */
function defendedAttack(state: GameState, deps: EngineDeps, attacker: InstanceId, ally: InstanceId) {
  const pick = (s: GameState): readonly string[] => {
    const prompt = s.pendingChoice?.prompt;
    if (prompt?.kind === "declareDefender")
      return [
        prompt.attack.enemyInstanceId === attacker && s.pendingChoice!.options.some((o) => o.optionId === ally)
          ? (ally as string)
          : "decline",
      ];
    return firstLegal(s);
  };
  const { state: after, events: all } = driveEventsPicking(deps, state, pick, toHero(P1), endTurn(P1));
  // Only the attacker's first attack of the phase: the ally exhausts defending it, a later one is undefended.
  const mine = (e: GameEvent) => "enemyInstanceId" in e && e.enemyInstanceId === attacker;
  const second = all.map((e, i) => (e.type === "attackResolved" && mine(e) ? i : -1)).filter((i) => i >= 0)[1];
  const events = second === undefined ? all : all.slice(0, second);
  const attack = events.find((e) => e.type === "attackResolved" && mine(e)) as Extract<
    GameEvent,
    { type: "attackResolved" }
  >;
  expect(attack).toBeDefined();
  const total = attack.baseAtk + attack.boostIcons - attack.defenseReduction;
  const hero = identityOf(after, P1);
  const dealt = (target: InstanceId) =>
    events.flatMap((e) =>
      e.type === "damageDealt" && e.sourceInstanceId === attacker && e.targetInstanceId === target ? [e.amount] : [],
    );
  const spilled = events.flatMap((e) => (e.type === "overkillSpilled" && e.fromInstanceId === ally ? [e.amount] : []));
  return { total, toAlly: dealt(ally), toHero: dealt(hero), spilled };
}

describe("granted overkill on a defended attack (sm, wave 5 cards; RRG 1.8 'Overkill')", () => {
  const sandman = () => startWave5Game(ghostSpiderScenario("sandman", { seed: 1 }));

  it("Rhino (27128): 'Rhino's attacks gain overkill and piercing' -- excess over the ally's last hit point spills to the hero", () => {
    const seated = withWoundedAlly(sandman(), WAVE5_DEPS);
    const rhino = engage(seated.state, "27128");
    const r = defendedAttack(rhino.state, WAVE5_DEPS, rhino.id, seated.ally);
    expect(r.total).toBeGreaterThanOrEqual(3);
    expect(r.toAlly).toEqual([r.total]);
    expect(r.spilled).toEqual([r.total - 1]);
    expect(r.toHero).toEqual([r.total - 1]);
  });

  // Control for Rhino: the Brute-force check that nothing but the printed card grants it -- the same hit from a
  // minion without an overkill grant (Symbiotic Thrall 27123, ATK printed, no overkill) never reaches the hero.
  it("control: a minion with no overkill grant (Symbiotic Thrall 27123) deals the hero nothing past the ally", () => {
    const seated = withWoundedAlly(
      startWave5Game(ghostSpiderScenario("venom-goblin", { seed: 7, modularSetIds: [encounterSetId("bomb_scare")] })),
      WAVE5_DEPS,
    );
    const thrall = engage(seated.state, "27123");
    const r = defendedAttack(thrall.state, WAVE5_DEPS, thrall.id, seated.ally);
    expect(r.spilled).toEqual([]);
    expect(r.toHero).toEqual([]);
    expect(r.toAlly.length).toBeGreaterThan(0);
  });

  it("Osborn Tech Arm Cannon (27147): the villain it is attached to attacks with overkill; unattached, none", () => {
    const venom = () =>
      startWave5Game(ghostSpiderScenario("venom", { seed: 1, modularSetIds: [encounterSetId("osborn_tech")] }));
    const hostId = (s: GameState) => s.villains[0]!.instanceId;
    const run = (attached: boolean) => {
      const seated = withWoundedAlly(venom(), WAVE5_DEPS);
      let state = patchInstance(seated.state, hostId(seated.state), {
        statuses: { ...seated.state.instances[hostId(seated.state)]!.statuses, tough: 0 },
      });
      if (attached) {
        const deck = activeEncounterDeckId(state);
        const pile = state.encounterDecks[deck]!;
        const cannon = [...pile.deck, ...pile.discard].find((i) => state.instances[i]?.cardId === cardId("27147"))!;
        const host = hostId(state);
        state = {
          ...state,
          encounterDecks: {
            ...state.encounterDecks,
            [deck]: { deck: pile.deck.filter((i) => i !== cannon), discard: pile.discard.filter((i) => i !== cannon) },
          },
          instances: {
            ...state.instances,
            [cannon]: { ...state.instances[cannon]!, faceup: true, attachedTo: host, controllerId: null },
            [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, cannon] },
          },
        };
      }
      return defendedAttack(state, WAVE5_DEPS, hostId(state), seated.ally);
    };
    const withCannon = run(true);
    expect(withCannon.total).toBeGreaterThanOrEqual(1);
    expect(withCannon.toAlly).toEqual([withCannon.total]);
    expect(withCannon.spilled).toEqual([withCannon.total - 1]);
    expect(withCannon.toHero).toEqual([withCannon.total - 1]);
    const control = run(false);
    expect(control.spilled).toEqual([]);
    expect(control.toHero).toEqual([]);
  });
});
