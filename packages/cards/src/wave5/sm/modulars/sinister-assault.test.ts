import { cardId, encounterSetId } from "@mc/content";
import {
  createGame,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
  type TriggerEvent,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  P1,
  endTurn,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  threatOn,
  toHero,
} from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../../testing/staging.js";
import { playToOutcome } from "../../../testing/driver.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";
import { wave5Scenario } from "../../setup.js";

/**
 * Sinister Assault (`sm` 27158-27163, `sinister-assault.ts`, docs/phase7-wave5.md §2.2). A `ghostSpiderScenario`
 * game (Ghost-Spider's own precon), `down-to-earth.test.ts`'s own modular-swap shape.
 *
 * Every test that drives a real villain phase (`endTurn`) also fights the scenario's own villain, who activates
 * *before* any engaged minion and, undefended, deals real damage of his own — enough on its own, stacked with the
 * staged minion's own attack, to eliminate Ghost-Spider's 10 HP identity before the staged minion's own Forced
 * Response ever gets a response window (an eliminated player's own card abilities don't get to act; the villain
 * proved immune to a `stunned`-cancels-its-attack workaround — Sandman's own reactivation and Venom's own
 * `27076b.leave-us-alone-forced-interrupt` both restore a cancelled attack). `surviveVillain` gives the identity a
 * single `tough` status card (a character can only ever hold one) to absorb the villain's own hit first, so the
 * staged minion's own attack — the *only* one under test — lands clean, undefended, second.
 */
const game = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("sinister_assault")] }));

/** `toHero` only when the identity isn't hero already — a game starts alter-ego by default (`setup.ts` Appendix II). */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));
const asAlterEgo = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "alterEgo" ? state : runWave5(state, toHero(P1));

/** A single `tough` status card, to absorb the scenario's own villain hit first (module docblock). */
function surviveVillain(state: GameState): GameState {
  const identity = identityOf(state, P1);
  return patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
}

/** The main scheme starts deep in negative threat so step 1's placement, the villain's own scheme, and the staged
 * minion's own scheme can never complete it mid-test (module docblock: nothing here is testing the main scheme). */
function safeMainScheme(state: GameState): GameState {
  const main = state.mainScheme.instanceId;
  return patchInstance(state, main, { threat: -100 });
}

/**
 * Moves an encounter-deck minion into `player`'s own play area, engaged with them — the engine's defeat sweep and
 * villain-phase activation step both key off a player's own `playArea`/`engagedWith`, not `villainArea`
 * (`down-to-earth.test.ts`'s own `engagedMinion` precedent).
 */
function engagedMinion(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterCardInVillainArea(state, code);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
      instances: { ...placed.state.instances, [placed.id]: { ...inst(placed.state, placed.id), engagedWith: player } },
    },
  };
}

/** Events from the villain phase onward — excludes the player phase's own end-of-turn hand-size discard, which
 * would otherwise pollute a "how many cards did *this ability* discard from your hand" count (Vulture). */
const duringVillainPhase = (events: readonly GameEvent[]): readonly GameEvent[] => {
  const start = events.findIndex((e) => e.type === "stepChanged" && e.to.phase === "villain");
  return start === -1 ? events : events.slice(start);
};

const threatPlacedBy = (events: readonly GameEvent[], source: InstanceId, scheme: InstanceId): number =>
  events
    .filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === source && e.schemeInstanceId === scheme,
    )
    .reduce((sum, e) => sum + e.amount, 0);

/** Resolved `dealDamage` trigger events sourced by `source` targeting `target`, distinguishing an attack's own
 * damage (`fromAttack: true`) from a card's own additional `dealDamage` effect (Scorpion's own "deal 2 damage",
 * Hobgoblin's indirect damage) — both log as plain `damageDealt` with the same `sourceInstanceId` (the attacker),
 * so only the richer `triggerEvent` log can tell them apart. */
const dealDamageEventsBy = (
  events: readonly GameEvent[],
  source: InstanceId,
  target: InstanceId,
): readonly Extract<TriggerEvent, { kind: "dealDamage" }>[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" &&
    e.phase === "resolved" &&
    e.event.kind === "dealDamage" &&
    e.event.sourceInstanceId === source &&
    e.event.targetInstanceId === target
      ? [e.event]
      : [],
  );

/** Puts named cards on top of `player`'s own deck, in order — `stackEncounterDeck`'s own player-deck twin. */
function stackPlayerDeck(state: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const id = owner.deck.find(wanted) ?? owner.discard.find(wanted);
    if (!id) throw new Error(`${player} has no ${code} in deck or discard`);
    ids.push(id);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: [...ids, ...p.deck.filter((id) => !ids.includes(id))],
            discard: p.discard.filter((id) => !ids.includes(id)),
          }
        : p,
    ),
  };
}

describe("Doctor Octopus (27158)", () => {
  it("27158.doctor-octopus-forced-response: after attacking you (hero form), places 1 threat on the main scheme", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27158");
    const main = staged.state.mainScheme.instanceId;
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    // Doctor Octopus attacks (ATK 2) — the attack itself places no threat, so every threatPlaced event sourced by
    // this card is the Forced Response's own "1 threat on each scheme" (only the main scheme is in play).
    expect(threatPlacedBy(events, staged.id, main)).toBe(1);
  });

  it("27158.doctor-octopus-forced-response: also fires when it schemes against you (alter-ego form)", () => {
    const base = safeMainScheme(asAlterEgo(game()));
    const staged = engagedMinion(base, "27158");
    const main = staged.state.mainScheme.instanceId;
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    // In alter-ego form Doctor Octopus schemes instead (SCH 2), itself placing threat on the scheme it targets as
    // one event; the Forced Response's own contribution is a *second*, separate event of amount 1.
    const amounts = events
      .filter(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
          e.type === "threatPlaced" && e.sourceInstanceId === staged.id,
      )
      .map((e) => e.amount);
    expect(amounts.filter((a) => a === 1)).toHaveLength(1);
    expect(threatPlacedBy(events, staged.id, main)).toBeGreaterThan(1); // its own scheme, plus the response's 1
  });

  it("27158.doctor-octopus-forced-response: negative — engaging alone (no activation yet) places no threat", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27158");
    const main = staged.state.mainScheme.instanceId;
    // `engagedMinion` is test surgery, not a real `minionEngaged` event: nothing has activated yet.
    expect(threatOn(staged.state, main)).toBe(threatOn(base, main));
  });
});

describe("Electro (27159)", () => {
  const stackTopEnergy = (state: GameState) => stackPlayerDeck(state, P1, "27022", "27020"); // Strength (physical), then Energy

  it("27159.electro-forced-response: engaging you alone discards from the top of your deck until an [energy]/[wild] resource", () => {
    const base = stackTopEnergy(safeMainScheme(surviveVillain(asHero(game()))));
    const [strength, energy] = playerOf(base, P1).deck.slice(0, 2);
    const staged = engagedMinion(base, "27159");
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    const discarded = events.filter(
      (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
        e.type === "cardMoved" && e.from.kind === "deck" && e.from.playerId === P1 && e.to.kind === "discard",
    );
    // Exactly Strength then Energy — the minionEngaged event fires once, before the villain or Electro have activated.
    expect(discarded.slice(0, 2).map((e) => e.instanceId)).toEqual([strength, energy]);
  });

  it("27159.electro-forced-response: fires again on the hero-form attack that follows engagement", () => {
    const base = stackTopEnergy(safeMainScheme(surviveVillain(asHero(game()))));
    const staged = engagedMinion(base, "27159");
    const { state: after } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    // Engage discards down to Energy (2 cards, deterministic — the stack above); the attack that follows discards
    // again, at least 1 more (every printed player card's own resourceIcons make an energy/wild match likely
    // within a card or two, but not guaranteed to be the very next one).
    expect(playerOf(after, P1).discard.length).toBeGreaterThanOrEqual(3);
  });

  it("27159.electro-forced-response: also fires when it schemes against you (alter-ego form)", () => {
    const base = stackTopEnergy(safeMainScheme(asAlterEgo(game())));
    const staged = engagedMinion(base, "27159");
    const before = playerOf(staged.state, P1).discard.length;
    const { state: after } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(playerOf(after, P1).discard.length).toBeGreaterThan(before + 1); // engage's 2, plus the scheme's own
  });

  it("27159.electro-forced-response: negative — a different (unengaged) minion does not touch your deck", () => {
    const base = stackTopEnergy(safeMainScheme(surviveVillain(asHero(game()))));
    const [top] = playerOf(base, P1).deck;
    encounterCardInVillainArea(base, "27159"); // Electro stays un-engaged, in the villain area — never activates
    const staged = engagedMinion(base, "27160"); // Hobgoblin engages instead
    const { state: after } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(playerOf(after, P1).deck).toContain(top);
  });
});

describe("Hobgoblin (27160)", () => {
  it("27160.hobgoblin-forced-response: after attacking you, take 2 indirect damage", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27160");
    const identity = identityOf(staged.state, P1);
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    const indirect = dealDamageEventsBy(events, staged.id, identity).filter((e) => !e.fromAttack);
    expect(indirect.reduce((sum, e) => sum + e.amount, 0)).toBe(2);
  });

  it("27160.hobgoblin-forced-response: negative — schemes instead of attacking in alter-ego form, no indirect damage", () => {
    const base = safeMainScheme(asAlterEgo(game()));
    const staged = engagedMinion(base, "27160");
    const identity = identityOf(staged.state, P1);
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(dealDamageEventsBy(events, staged.id, identity)).toHaveLength(0);
  });
});

describe("Kraven the Hunter (27161)", () => {
  /** Web-Bracelet (27009): Ghost-Spider's own precon upgrade — attached directly (test surgery), the way
   * `osborn-tech.test.ts`'s own `attachToHost` treats a card that isn't already in play. */
  function withBracelet(state: GameState): { readonly state: GameState; readonly bracelet: InstanceId } {
    const bracelet = instancesOf(state, "27009")[0];
    if (!bracelet) throw new Error("Ghost-Spider's deck has no Web-Bracelet (27009)");
    const identity = identityOf(state, P1);
    return {
      bracelet,
      state: {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1
            ? { ...p, deck: p.deck.filter((id) => id !== bracelet), playArea: [...p.playArea, bracelet] }
            : p,
        ),
        instances: { ...state.instances, [bracelet]: { ...inst(state, bracelet), attachedTo: identity } },
      },
    };
  }

  it("27161.kraven-the-hunter-forced-response: after attacking and damaging your identity, discards an upgrade you control", () => {
    const base = withBracelet(safeMainScheme(surviveVillain(asHero(game()))));
    const staged = engagedMinion(base.state, "27161");
    const { state: after } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(playerOf(after, P1).playArea).not.toContain(base.bracelet);
    expect(playerOf(after, P1).discard).toContain(base.bracelet);
  });

  it("27161.kraven-the-hunter-forced-response: negative — a different (unengaged) minion's damage doesn't discard your upgrade", () => {
    // Kraven stays un-engaged, in the villain area — never activates, so only the scenario's own villain attacks
    // and damages the identity (Kraven's own `selfIs: "source"` never matches that attack's source). `surviveVillain`
    // keeps the identity (and its play area) intact so the "nothing was discarded" check stays meaningful.
    const base = withBracelet(safeMainScheme(surviveVillain(asHero(game()))));
    const kraven = encounterCardInVillainArea(base.state, "27161");
    const { state: after, events } = driveEvents(WAVE5_DEPS, base.state, endTurn(P1));
    expect(events.some((e) => e.type === "enemyActivated" && e.enemyInstanceId === kraven.id)).toBe(false); // never activated
    expect(playerOf(after, P1).playArea).toContain(base.bracelet);
    expect(playerOf(after, P1).discard).not.toContain(base.bracelet);
  });
});

describe("Scorpion (27162)", () => {
  it("27162.scorpion-forced-response: after attacking and damaging your identity, stuns it", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27162");
    const identity = identityOf(staged.state, P1);
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    const attackDamage = dealDamageEventsBy(events, staged.id, identity).filter((e) => e.fromAttack);
    expect(attackDamage.reduce((sum, e) => sum + e.amount, 0)).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "statusGiven" && e.instanceId === identity && e.status === "stunned")).toBe(
      true,
    );
  });

  it("27162.scorpion-forced-response: if the damaged character is already stunned, deals 2 damage to it instead of stunning", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27162");
    const identity = identityOf(staged.state, P1);
    const prestunned = patchInstance(staged.state, identity, {
      statuses: { ...inst(staged.state, identity).statuses, stunned: 1 },
    });
    const { events } = driveEvents(WAVE5_DEPS, prestunned, endTurn(P1));
    const dealt = dealDamageEventsBy(events, staged.id, identity);
    const attackDamage = dealt.filter((e) => e.fromAttack).reduce((sum, e) => sum + e.amount, 0);
    const responseDamage = dealt.filter((e) => !e.fromAttack).reduce((sum, e) => sum + e.amount, 0);
    expect(attackDamage).toBeGreaterThan(0);
    expect(responseDamage).toBe(2); // the Forced Response's own "deal 2 damage to it" — no second `stunned` grant.
  });

  it("27162.scorpion-forced-response: negative — a different (unengaged) minion's damage neither stuns nor extra-damages", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const scorpion = encounterCardInVillainArea(base, "27162");
    const identity = identityOf(base, P1);
    const { events } = driveEvents(WAVE5_DEPS, base, endTurn(P1));
    expect(events.some((e) => e.type === "enemyActivated" && e.enemyInstanceId === scorpion.id)).toBe(false);
    expect(dealDamageEventsBy(events, scorpion.id, identity)).toHaveLength(0); // Scorpion never attacked (unengaged)
    expect(events.some((e) => e.type === "statusGiven" && e.instanceId === identity && e.status === "stunned")).toBe(
      false,
    );
  });
});

describe("Vulture (27163)", () => {
  const handDiscardsDuringVillainPhase = (events: readonly GameEvent[]): number =>
    duringVillainPhase(events).filter(
      (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
        e.type === "cardMoved" && e.from.kind === "hand" && e.from.playerId === P1 && e.to.kind === "discard",
    ).length;

  it("27163.vulture-forced-response: after attacking you (hero form), discards 1 random card from your hand", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    const staged = engagedMinion(base, "27163");
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(handDiscardsDuringVillainPhase(events)).toBe(1);
  });

  it("27163.vulture-forced-response: also fires when it schemes against you (alter-ego form)", () => {
    const base = safeMainScheme(asAlterEgo(game()));
    const staged = engagedMinion(base, "27163");
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(handDiscardsDuringVillainPhase(events)).toBe(1);
  });

  it("27163.vulture-forced-response: negative — a different (unengaged) minion never discards your hand", () => {
    const base = safeMainScheme(surviveVillain(asHero(game())));
    encounterCardInVillainArea(base, "27163"); // Vulture stays un-engaged, in the villain area — never activates
    const staged = engagedMinion(base, "27160"); // Hobgoblin engages instead
    const { events } = driveEvents(WAVE5_DEPS, staged.state, endTurn(P1));
    expect(handDiscardsDuringVillainPhase(events)).toBe(0);
  });
});

describe("wave5Scenario with Sinister Assault swapped in", () => {
  it("Venom, solo: Ghost-Spider, with Sinister Assault in place of the scenario's own recommended modular", () => {
    const config = ghostSpiderScenario("venom", { seed: 2026, modularSetIds: [encounterSetId("sinister_assault")] });
    expect(config.encounterDeck).toContain(cardId("27158"));
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE5_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE5_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  it("also builds via wave5Scenario directly (a Core precon), unaffected by the swap", () => {
    expect(() =>
      wave5Scenario("venom", {
        seed: 3,
        players: [{ starterDeckId: "core-captain-marvel-leadership" }],
        modularSetIds: [encounterSetId("sinister_assault")],
      }),
    ).not.toThrow();
  });
});
