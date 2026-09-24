/**
 * docs/phase7-wave3.md §3.28–§3.31: four Galaxy's Most Wanted wordings the scripting pass recorded as primitive gaps,
 * each of which composes from vocabulary already in the engine (one timing fix aside, §3.28). Synthetic cards shaped
 * like the printed ones; the names in the titles only say which printed text each shape was built for.
 *
 * - §3.28 "Hero Response: After Groot uses a basic power, remove 2 growth counters from him and exhaust Lashing Vines
 *   → ready Groot." (Lashing Vines 16009): `basicPowerUsed` covers every basic power; a defense's responses wait for the
 *   attack to end (RRG 1.8 "Defend, Defense", p. 16).
 * - §3.29 "Hero Action: Exhaust Deft Focus → reduce the resource cost of the next superpower card you play this turn by
 *   1." (Deft Focus 16024): `reduceNextCardCost` `duration: "turn"` with a trait `cardFilter`.
 * - §3.30 "Hero Action: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of
 *   damage to an enemy." (Schadenfreude 16032): `eachTimeUntil` (§3.17) with the "you deal damage" pattern — RRG 1.8
 *   "You, Your" (p. 49) and "Prevent" (p. 35).
 * - §3.31 "Response: After you spend this card, put a tech upgrade from your discard pile on top of your deck."
 *   (Salvage 16033): `resourcesSpent` (docs/phase7-wave2.md §12), resolving before the paid-for card (RRG 1.8
 *   "Initiating Abilities", p. 24, steps 5–6; ruling, Feb 28, 2026 (1)).
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { PlayerRef, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you: PlayerRef = { kind: "controller" };
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: P1 };
const SUPERPOWER = trait("SUPERPOWER");
const TECH = trait("TECH");
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(6), targetThreat: flat(40), acceleration: flat(0) }],
});

const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const villainOf = (state: GameState): InstanceId => state.activeVillainId;
/** Test surgery on an instance, before the session starts (so a replay reproduces it). */
function patch(state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } } };
}
/** Accepts every optional trigger or card choice whose option id names one of `ids`; otherwise the default pick. */
const accepting =
  (...ids: readonly string[]) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") {
      const identity = identityOf(state);
      return choice.options.some((o) => o.optionId === identity) ? [identity] : ["decline"];
    }
    const wanted = choice.options.filter((o) => ids.some((id) => o.optionId.includes(id)));
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections).map((o) => o.optionId) : defaultPick(state);
  };
const replays = (session: ReturnType<typeof driveSession>["session"], deps: EngineDeps, state: GameState): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(state);
};

// ---------------------------------------------------------------------------------------------------------------
// §3.28 Lashing Vines
// ---------------------------------------------------------------------------------------------------------------

const VINES_ABILITY = stubAbility(
  "vines.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      form: "hero",
      on: { on: "basicPowerUsed", targetIs: { categories: ["identity"], controller: "you" } },
    },
    cost: { exhaustSelf: true, spendCounters: { counterType: "growth", amount: 2, target: "identity" } },
    effects: [{ kind: "ready", target: yourIdentity }],
  }),
);
const VINES = stubUpgrade({ id: "vines", cost: 1, abilities: [VINES_ABILITY.ref] });

describe("§3.28 'After Groot uses a basic power' (Lashing Vines)", () => {
  const deps = depsOf(VINES_ABILITY);
  function start(): { state: GameState; vines: InstanceId } {
    const base = gameAtFirstTurn({ cards: [VINES, SCHEME], deps, mainScheme: SCHEME, deck: copiesOf(VINES.id, 1) });
    const placed = playerCardIntoPlay(base, VINES.id);
    return { state: patch(placed.state, identityOf(placed.state), { counters: { growth: 4 } }), vines: placed.id };
  }

  it("fires after a basic attack and after a basic thwart, paying its counters and readying the hero", () => {
    for (const power of ["attack", "thwart"] as const) {
      const { state, vines } = start();
      const use: Command =
        power === "attack"
          ? {
              type: "basicAttack",
              playerId: P1,
              attackerInstanceId: identityOf(state),
              targetInstanceId: villainOf(state),
            }
          : {
              type: "basicThwart",
              playerId: P1,
              thwarterInstanceId: identityOf(state),
              schemeInstanceId: state.mainScheme.instanceId,
            };
      const { session } = driveSession(startSession(state), deps, [toHero, use], accepting("vines.response"));
      const after = session.state;
      expect(mustInstance(after, identityOf(after)).exhausted).toBe(false);
      expect(mustInstance(after, identityOf(after)).counters.growth).toBe(2);
      expect(mustInstance(after, vines).exhausted).toBe(true);
      replays(session, deps, after);
    }
  });

  it("after a basic defense, resolves once the attack has ended (RRG 1.8 'Defend, Defense', p. 16)", () => {
    const { state } = start();
    const { session, events } = driveSession(
      startSession(state),
      deps,
      [toHero, { type: "endTurn", playerId: P1 }],
      accepting("vines.response"),
    );
    const index = (match: (e: GameEvent) => boolean): number => events.findIndex(match);
    const defended = index((e) => e.type === "defenderDeclared");
    const attackOver = index((e) => e.type === "attackResolved");
    const vinesResolved = index((e) => e.type === "abilityResolved" && e.abilityId === VINES_ABILITY.ref.id);
    expect(defended).toBeGreaterThanOrEqual(0);
    expect(attackOver).toBeGreaterThan(defended);
    expect(vinesResolved).toBeGreaterThan(attackOver);
    replays(session, deps, session.state);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.29 Deft Focus
// ---------------------------------------------------------------------------------------------------------------

const FOCUS_ABILITY = stubAbility(
  "focus.action",
  def({
    trigger: { kind: "action", form: "hero" },
    cost: { exhaustSelf: true },
    effects: [
      { kind: "reduceNextCardCost", player: you, amount: n(1), duration: "turn", cardFilter: { trait: SUPERPOWER } },
    ],
  }),
);
const FOCUS = stubUpgrade({ id: "focus", cost: 1, abilities: [FOCUS_ABILITY.ref] });
const POWER = stubUpgrade({ id: "power", cost: 1, traits: [SUPERPOWER] });
const PLAIN = stubUpgrade({ id: "plain", cost: 1 });

describe("§3.29 'the next superpower card you play this turn' (Deft Focus)", () => {
  const deps = depsOf(FOCUS_ABILITY);
  const cards = [FOCUS, POWER, PLAIN];
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });

  it("waits through a non-matching card, is used up by the next superpower card, and reduces only that one", () => {
    const base = gameAtFirstTurn({ cards, deps, deck: [...copiesOf(POWER.id, 2), PLAIN.id, FOCUS.id] });
    const focus = playerCardIntoPlay(base, FOCUS.id);
    let state = focus.state;
    const ids: InstanceId[] = [];
    for (const card of [PLAIN.id, POWER.id, POWER.id]) {
      const given = giveCard(state, P1, card, ids);
      state = given.state;
      ids.push(given.id);
    }
    const [plain, power1, power2] = ids as [InstanceId, InstanceId, InstanceId];
    const { session } = driveSession(startSession(state), deps, [
      toHero,
      { type: "useAbility", playerId: P1, cardInstanceId: focus.id, abilityId: FOCUS_ABILITY.ref.id, payment: [] },
    ]);
    // A plain card costs its full 1 and does not use the reduction.
    expect(applyCommand(session.state, play(plain), deps).ok).toBe(false);
    // The first superpower card costs 0 …
    const played = driveSession(session, deps, [play(power1)]).session;
    expect(mustPlayer(played.state, P1).hand).not.toContain(power1);
    // … and used the reduction up: the second costs its full 1 again.
    expect(applyCommand(played.state, play(power2), deps).ok).toBe(false);
    replays(played, deps, played.state);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.30 Schadenfreude
// ---------------------------------------------------------------------------------------------------------------

/** `on.youDealDamage(ENEMY)` from `@mc/cards`, written out: RRG 1.8 "You, Your" (p. 49), "Prevent" (p. 35). */
const YOU_DEAL_DAMAGE_TO_AN_ENEMY: EventPattern = {
  on: "dealDamage",
  sourceIs: { controller: "you", categories: ["identity", "event", "resource", "upgrade"] },
  targetIs: { categories: ["enemy"] },
  eventAtLeast: { amount: 1 },
};
const SCHADENFREUDE_ABILITY = stubAbility(
  "schadenfreude.action",
  def({
    trigger: { kind: "action", form: "hero" },
    effects: [
      {
        kind: "eachTimeUntil",
        until: "endOfTurn",
        on: YOU_DEAL_DAMAGE_TO_AN_ENEMY,
        effects: [{ kind: "heal", target: yourIdentity, amount: n(2) }],
      },
    ],
  }),
);
const SCHADENFREUDE = stubEvent({ id: "schadenfreude", cost: 0, abilities: [SCHADENFREUDE_ABILITY.ref] });
const BLAST_ABILITY = stubAbility(
  "blast.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }] }),
);
const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [BLAST_ABILITY.ref] });
const TURRET_ABILITY = stubAbility(
  "turret.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
  }),
);
const TURRET = stubSupport({ id: "turret", cost: 0, abilities: [TURRET_ABILITY.ref] });

describe("§3.30 'each time you deal any amount of damage to an enemy' (Schadenfreude)", () => {
  const deps = depsOf(SCHADENFREUDE_ABILITY, BLAST_ABILITY, TURRET_ABILITY);
  const cards = [SCHADENFREUDE, BLAST, TURRET];
  function start(): { state: GameState; schadenfreude: InstanceId; blast: InstanceId } {
    const base = gameAtFirstTurn({
      cards,
      deps,
      deck: [SCHADENFREUDE.id, BLAST.id, TURRET.id, ALLY.id],
    });
    const hurt = patch(base, identityOf(base), { damage: 8 });
    const a = giveCard(hurt, P1, SCHADENFREUDE.id);
    const b = giveCard(a.state, P1, BLAST.id);
    return { state: b.state, schadenfreude: a.id, blast: b.id };
  }
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });
  const damage = (state: GameState): number => mustInstance(state, identityOf(state)).damage;

  it("heals after your hero's basic attack and after your event's damage", () => {
    const { state, schadenfreude, blast } = start();
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: villainOf(state),
    };
    const { session } = driveSession(startSession(state), deps, [toHero, play(schadenfreude), attack, play(blast)]);
    expect(damage(session.state)).toBe(8 - 2 - 2);
    replays(session, deps, session.state);
  });

  it("heals when the damage is dealt but a tough status card prevents all of it (RRG 1.8 'Prevent', p. 35)", () => {
    const { state, schadenfreude, blast } = start();
    const tough = patch(state, villainOf(state), {
      statuses: { ...mustInstance(state, villainOf(state)).statuses, tough: 1 },
    });
    const { session } = driveSession(startSession(tough), deps, [toHero, play(schadenfreude), play(blast)]);
    expect(mustInstance(session.state, villainOf(session.state)).damage).toBe(0);
    expect(damage(session.state)).toBe(8 - 2);
  });

  it("does not heal for an ally's attack or a support's damage (RRG 1.8 'You, Your', p. 49)", () => {
    const { state, schadenfreude } = start();
    const ally = playerCardIntoPlay(state, ALLY.id);
    const turret = playerCardIntoPlay(ally.state, TURRET.id);
    const { session } = driveSession(startSession(turret.state), deps, [
      toHero,
      play(schadenfreude),
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally.id, targetInstanceId: villainOf(state) },
      { type: "useAbility", playerId: P1, cardInstanceId: turret.id, abilityId: TURRET_ABILITY.ref.id, payment: [] },
    ]);
    expect(mustInstance(session.state, villainOf(session.state)).damage).toBe(3);
    expect(damage(session.state)).toBe(8);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.31 Salvage
// ---------------------------------------------------------------------------------------------------------------

const SALVAGE_ABILITY = stubAbility(
  "salvage.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: { on: "resourcesSpent", selfIs: "source", playerIs: "controller" },
    },
    effects: [
      {
        kind: "chooseCards",
        slot: "tech",
        from: { kind: "zone", zone: "discard", player: you, filter: { categories: ["upgrade"], trait: TECH } },
        chooser: you,
        min: 1,
        max: 1,
      },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tech" } }, to: "deckTop" },
    ],
  }),
);
const SALVAGE = stubResource({ id: "salvage", icons: 1, abilities: [SALVAGE_ABILITY.ref] });
const GADGET = stubUpgrade({ id: "gadget", cost: 3, traits: [TECH] });
const STUDY_ABILITY = stubAbility(
  "study.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "draw", player: you, amount: n(1) }] }),
);
const STUDY = stubEvent({ id: "study", cost: 1, abilities: [STUDY_ABILITY.ref] });

describe("§3.31 'After you spend this card, put a tech upgrade from your discard pile on top of your deck' (Salvage)", () => {
  const deps = depsOf(SALVAGE_ABILITY, STUDY_ABILITY);

  it("resolves from the discard pile before the paid-for card, so that card's draw takes the tech upgrade", () => {
    const base = gameAtFirstTurn({ cards: [SALVAGE, GADGET, STUDY], deps, deck: [SALVAGE.id, GADGET.id, STUDY.id] });
    const salvage = giveCard(base, P1, SALVAGE.id);
    const study = giveCard(salvage.state, P1, STUDY.id);
    const gadget = giveCard(study.state, P1, GADGET.id);
    // The Tech upgrade starts in the discard pile.
    const seat = mustPlayer(gadget.state, P1);
    const state: GameState = {
      ...gadget.state,
      players: gadget.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: seat.hand.filter((id) => id !== gadget.id), discard: [gadget.id, ...seat.discard] }
          : p,
      ),
    };
    const { session } = driveSession(
      startSession(state),
      deps,
      [
        {
          type: "playCard",
          playerId: P1,
          cardInstanceId: study.id,
          payment: [{ fromHand: salvage.id }],
          attachToInstanceId: null,
        },
      ],
      accepting("salvage.response"),
    );
    const after = mustPlayer(session.state, P1);
    expect(after.hand).toContain(gadget.id);
    expect(after.discard).toContain(salvage.id);
    replays(session, deps, session.state);
  });
});
