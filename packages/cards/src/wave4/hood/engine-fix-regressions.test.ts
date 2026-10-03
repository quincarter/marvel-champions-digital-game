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
import { attachedTo, foldModularSetIntoDeck, game } from "./testing.js";

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

// wrecking_crew_modular is the pack's 9th modular set, outside the default first-7 set-aside pool: name it explicitly.
const SETS_WITH_WRECKING_CREW = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "wrecking_crew_modular",
];

describe("granted overkill on a defended attack (hood)", () => {
  it("Bulldozer (24066): 'Bulldozer's attacks gain overkill' -- excess over the ally's last hit point spills to the hero", () => {
    const base = foldModularSetIntoDeck(game(1, [], SETS_WITH_WRECKING_CREW), "wrecking_crew_modular");
    const seated = withWoundedAlly(base, WAVE4_DEPS);
    const bulldozer = engage(seated.state, "24066");
    const r = defendedAttack(bulldozer.state, WAVE4_DEPS, bulldozer.id, seated.ally);
    expect(r.total).toBeGreaterThanOrEqual(3);
    expect(r.toAlly).toEqual([r.total]);
    expect(r.spilled).toEqual([r.total - 1]);
    expect(r.toHero).toEqual([r.total - 1]);
  });

  it("Tech Gauntlets (24040): 'Attached minion's attacks gain overkill' -- only the minion wearing them spills", () => {
    // Mandrill (24016, ATK 2, no keywords) is a plain minion; the Gauntlets also print ATK +1 (`statModifiers`), so the
    // attack is 3 with them and 2 without, against the ally's 1 remaining hit point. A non-villainous minion draws no
    // boost card.
    const run = (gauntlets: boolean) => {
      const base = foldModularSetIntoDeck(
        foldModularSetIntoDeck(game(1, [], SETS_WITH_WRECKING_CREW), "beasty_boys"),
        "ransacked_armory",
      );
      const seated = withWoundedAlly(base, WAVE4_DEPS);
      const mandrill = engage(seated.state, "24016");
      const staged = gauntlets ? attachedTo(mandrill.state, "24040", mandrill.id).state : mandrill.state;
      return defendedAttack(staged, WAVE4_DEPS, mandrill.id, seated.ally);
    };
    const withGauntlets = run(true);
    expect(withGauntlets.total).toBe(3);
    expect(withGauntlets.toAlly).toEqual([3]);
    expect(withGauntlets.spilled).toEqual([2]);
    expect(withGauntlets.toHero).toEqual([2]);
    const control = run(false);
    expect(control.total).toBe(2);
    expect(control.toAlly).toEqual([2]);
    expect(control.spilled).toEqual([]);
    expect(control.toHero).toEqual([]);
  });
});
