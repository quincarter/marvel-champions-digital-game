/**
 * docs/phase7-wave2.md §13: "until the end of this turn" (`LastingUntil "endOfTurn"`) and "…you play this turn"
 * (`reduceNextCardCost` `duration: "turn"`). Synthetic cards; the names in the titles only say which printed text each
 * shape was built for.
 *
 * Sources: RRG 1.8 "Player Phase" (p. 34): "each player (in player order) takes one turn", so a turn is shorter than
 * the phase once there are two players; "Lasting Effects" (p. 26): "A lasting effect expires as soon as the timing
 * point specified by its duration is reached" and "A lasting effect that expires at the end of a specified time period
 * can only be initiated during that time period."
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, mustPlayer } from "./query.js";
import type { LastingUntil } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const you = { kind: "identityOf", player: { kind: "controller" } } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});

/** "Action: you get +1 ATK until the end of <until>." (Giant Strength 12009 is the `endOfTurn` one.) */
const boostFor = (until: LastingUntil) =>
  stubAbility(
    `boost-${until}`,
    def({
      trigger: { kind: "action" },
      effects: [{ kind: "modifyStatUntil", stat: "atk", amount: { kind: "const", value: 1 }, target: you, until }],
    }),
  );
const TURN_BOOST = boostFor("endOfTurn");
const PHASE_BOOST = boostFor("endOfPhase");
const TRAINER = stubSupport({ id: "trainer", cost: 0, abilities: [TURN_BOOST.ref, PHASE_BOOST.ref] });

/** "Forced Response: After the player phase ends, you get +1 ATK until the end of this turn / this phase." */
const lateBoost = (until: LastingUntil) =>
  stubAbility(
    `late-${until}`,
    def({
      trigger: { kind: "response", forced: true, on: { on: "playerPhaseEnded" } },
      effects: [{ kind: "modifyStatUntil", stat: "atk", amount: { kind: "const", value: 1 }, target: you, until }],
    }),
  );
const LATE_TURN = lateBoost("endOfTurn");
const LATE_PHASE = lateBoost("endOfPhase");
const LATECOMER = stubSupport({ id: "latecomer", cost: 0, abilities: [LATE_TURN.ref, LATE_PHASE.ref] });

/** "Action: reduce the resource cost of the next card you play this turn by 1." (Deft Focus, `magneto` 49023.) */
const FOCUS_ABILITY = stubAbility(
  "focus",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "reduceNextCardCost",
        player: { kind: "controller" },
        amount: { kind: "const", value: 1 },
        duration: "turn",
      },
    ],
  }),
);
const FOCUS = stubSupport({ id: "focus", cost: 0, abilities: [FOCUS_ABILITY.ref] });

function setup(): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(TURN_BOOST, PHASE_BOOST, LATE_TURN, LATE_PHASE, FOCUS_ABILITY);
  const state = newGame({
    players: 2,
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: SCHEME,
    extraCards: [BLANK, TRAINER, LATECOMER, FOCUS],
    deck: [...copies(TRAINER.id), ...copies(LATECOMER.id), ...copies(FOCUS.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 30),
    deps,
  });
  return { deps, state };
}

const playFree = (player: typeof p1, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (player: typeof p1, id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [],
});
const atkOf = (deps: EngineDeps, state: GameState, player: typeof p1) =>
  characterProfile(state, mustPlayer(state, player).identity.instanceId, deps)?.atk ?? 0;
const added = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "lastingEffectAdded" ? [e.effect.duration.kind] : []));

describe("§13 'until the end of this turn' (LastingUntil endOfTurn)", () => {
  it("ends with the player's turn, while an 'end of the phase' effect made at the same time outlives it (RRG p. 34, p. 26)", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "trainer");
    const trainer = given.ids[0] as InstanceId;
    const base = atkOf(deps, given.state, p1);
    const boosted = runCommands(
      given.state,
      deps,
      playFree(p1, trainer),
      use(p1, trainer, TURN_BOOST.ref.id),
      use(p1, trainer, PHASE_BOOST.ref.id),
    ).state;
    expect(atkOf(deps, boosted, p1)).toBe(base + 2);

    const { state: nextTurn, events } = runCommands(boosted, deps, { type: "endTurn", playerId: p1 });
    // Still the player phase — p2's turn — so only the turn-long effect has gone.
    expect(nextTurn.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: p2 });
    expect(atkOf(deps, nextTurn, p1)).toBe(base + 1);
    expect(nextTurn.lastingEffects.map((e) => e.duration.kind)).toEqual(["endOfPhase"]);
    // It expired at the turn's end, before p2's turn began.
    const ended = events.findIndex((e) => e.type === "lastingEffectEnded" && e.reason === "expired");
    const began = events.findIndex((e) => e.type === "turnStarted" && e.playerId === p2);
    expect(ended).toBeGreaterThanOrEqual(0);
    expect(ended).toBeLessThan(began);
  });

  it("is not created at all outside a player's turn (RRG 1.8 'Lasting Effects', p. 26: 'can only be initiated during that time period')", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "latecomer");
    const latecomer = given.ids[0] as InstanceId;
    const inPlay = runCommands(given.state, deps, playFree(p1, latecomer)).state;
    // Both players end their turns; the player phase ends and the forced response fires in no one's turn.
    const { events } = runCommands(inPlay, deps, { type: "endTurn", playerId: p1 }, { type: "endTurn", playerId: p2 });
    expect(added(events)).toEqual(["endOfPhase"]);
  });

  it("'the next card you play this turn' (reduceNextCardCost duration 'turn') expires unused at the turn's end", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "focus");
    const focus = given.ids[0] as InstanceId;
    const focused = runCommands(given.state, deps, playFree(p1, focus), use(p1, focus, FOCUS_ABILITY.ref.id)).state;
    expect(focused.lastingEffects).toMatchObject([
      { kind: "costReduction", playerId: p1, amount: 1, duration: { kind: "endOfTurn" } },
    ]);
    const nextTurn = runCommands(focused, deps, { type: "endTurn", playerId: p1 }).state;
    expect(nextTurn.lastingEffects).toEqual([]);
  });
});
