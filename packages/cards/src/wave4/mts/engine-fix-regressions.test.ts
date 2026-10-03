import { cardId } from "@mc/content";
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
import { WAVE4_DEPS } from "../index.js";
import { startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

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

describe("granted overkill on a defended attack (mts)", () => {
  const ebonyMaw = () => startWave4Game(spectrumScenario("ebony-maw", { seed: 1 }));

  it("Black Dwarf (21085): 'Black Dwarf's attack gain overkill' -- excess over the ally's last hit point spills to the hero", () => {
    const seated = withWoundedAlly(ebonyMaw(), WAVE4_DEPS);
    const dwarf = engage(seated.state, "21085");
    const r = defendedAttack(dwarf.state, WAVE4_DEPS, dwarf.id, seated.ally);
    expect(r.total).toBeGreaterThanOrEqual(3);
    expect(r.toAlly).toEqual([r.total]);
    expect(r.spilled).toEqual([r.total - 1]);
    expect(r.toHero).toEqual([r.total - 1]);
  });

  it("control: a minion with no overkill grant (Black Order Infantry (21089, ATK 2)) deals the hero nothing past the ally", () => {
    const seated = withWoundedAlly(ebonyMaw(), WAVE4_DEPS);
    const minion = engage(seated.state, "21089");
    const r = defendedAttack(minion.state, WAVE4_DEPS, minion.id, seated.ally);
    expect(r.total).toBeGreaterThanOrEqual(2);
    expect(r.toAlly).toEqual([r.total]);
    expect(r.spilled).toEqual([]);
    expect(r.toHero).toEqual([]);
  });
});
