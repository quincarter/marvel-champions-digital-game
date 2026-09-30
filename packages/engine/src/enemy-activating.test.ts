/**
 * docs/phase7-wave5.md §3.2: an enemy activation that can be interrupted and canceled. Synthetic cards shaped like Web
 * Binding (`sm` 27006: "When an enemy would activate, cancel that activation. If a minion's activation was cancelled
 * this way, deal 4 damage to that minion.", here a forced interrupt on a support so no choice is asked) and Sinister
 * Synchronization 1B (27100b: "Forced Interrupt: When a villain would activate, if no villain is in play, resolve this
 * card's 'Ambush!' ability. Continue that activation.").
 *
 * Sources: RRG 1.8 "Activation" (p. 6), "Interrupt" (p. 25), "Cancel" (p. 12); FAQ "Norman Osborn (#1A)" (p. 58: status
 * cards take priority, so a stun replaces the activation before anything can interrupt it).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, undefeatedVillains } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const BINDING = stubAbility("binding.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating", targetIs: { categories: ["enemy"] } } },
  effects: [
    { kind: "cancelTriggeringEvent" },
    {
      kind: "if",
      condition: { kind: "refMatches", ref: { kind: "eventTarget" }, query: { categories: ["minion"] } },
      then: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: 4 } }],
    },
  ],
});
const BINDER = stubSupport({ id: "binder", cost: 0, abilities: [BINDING.ref] });

const AMBUSH = stubAbility("synchronization.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating" } },
  effects: [
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "exists", query: { categories: ["villain"] } } },
      then: [
        {
          kind: "selectCards",
          slot: "pick",
          cards: {
            kind: "encounterSetAside",
            filter: { categories: ["villain"] },
            random: { kind: "const", value: 1 },
          },
        },
        { kind: "addVillain", villain: { kind: "slot", slot: "pick" } },
      ],
    },
  ],
});
const SCHEMING = stubVillain({ id: "schemer", stages: [{ hp: flat(10), atk: 1, sch: 2 }] });
const SECOND = stubVillain({ id: "second", stages: [{ hp: flat(10), atk: 1, sch: 3 }] });
const PLAIN = stubMainScheme({
  id: "plain",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const SYNCHRONIZATION = stubMainScheme({
  id: "synchronization",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [AMBUSH.ref] }],
});
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 6, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const SUMMON_ABILITY = stubAbility("summon.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "selectCards", slot: "thug", cards: { kind: "encounter", zones: ["deck"], filter: { name: "thug" } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "thug" }, controller: { kind: "controller" } },
  ],
});
const SUMMON = stubEvent({ id: "summon", cost: 0, abilities: [SUMMON_ABILITY.ref] });
const STUN_ABILITY = stubAbility("stun.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "giveStatus", target: { kind: "villain" }, status: "confused" }],
});
const STUN = stubEvent({ id: "confuse-villain", cost: 0, abilities: [STUN_ABILITY.ref] });

const deps: EngineDeps = depsOf(BINDING, AMBUSH, SUMMON_ABILITY, STUN_ABILITY);

function start(options: { readonly setAside?: boolean } = {}): GameState {
  const setAside = options.setAside === true;
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, SCHEMING, SECOND, PLAIN, SYNCHRONIZATION, THUG, FILLER, BINDER, SUMMON, STUN],
      villainCardId: SCHEMING.id,
      ...(setAside
        ? {
            villains: [
              { villainCardId: SCHEMING.id, encounterDeck: [] },
              { villainCardId: SECOND.id, encounterDeck: [] },
            ],
            sharedEncounterDeck: true,
            villainsStartSetAside: true as const,
            victory: "cardAbility" as const,
          }
        : { setAsideVillainCardIds: [] }),
      mainSchemeCardId: (setAside ? SYNCHRONIZATION : PLAIN).id,
      encounterDeck: [...copiesOf(FILLER.id, 20), THUG.id],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, BINDER.id, SUMMON.id, STUN.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

/** Ends the player's turn, running the villain phase with every choice defaulted. */
function villainPhase(state: GameState) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(`expected a turn, got ${step.kind}`);
  const { session, events } = driveSession(startSession(state), deps, [
    { type: "endTurn", playerId: step.activePlayerId },
  ]);
  return { state: session.state, events, session };
}
const threatOnMainScheme = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const schemed = (events: readonly GameEvent[]) => events.filter((e) => e.type === "enemyActivated");

describe("§3.2 'When an enemy would activate'", () => {
  it("with nothing listening the villain schemes as before; cancelled, it does not scheme at all", () => {
    const plain = villainPhase(start());
    expect(threatOnMainScheme(plain.state)).toBe(2);
    const bound = villainPhase(playerCardIntoPlay(start(), BINDER.id).state);
    expect(threatOnMainScheme(bound.state)).toBe(0);
    expect(schemed(bound.events)).toHaveLength(1);
    const replayed = replay(bound.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(bound.session.state);
  });

  it("a minion's activation is cancelled too, and that minion takes 4 damage", () => {
    const bound = playerCardIntoPlay(start(), BINDER.id).state;
    const summoned = playFree(bound, deps, SUMMON.id).state;
    const thug = summoned.players[0]!.playArea.find((id) => mustInstance(summoned, id).cardId === THUG.id)!;
    const { state } = villainPhase(summoned);
    expect(mustInstance(state, thug).damage).toBe(4);
    expect(threatOnMainScheme(state)).toBe(0);
  });

  it("a status card replaces the activation first, so the interrupt never sees it (FAQ p. 58)", () => {
    const bound = playerCardIntoPlay(start(), BINDER.id).state;
    const confused = playFree(bound, deps, STUN.id).state;
    const { state, events } = villainPhase(confused);
    expect(mustInstance(state, state.activeVillainId).statuses.confused).toBe(0);
    expect(events.some((e) => e.type === "statusRemoved" && e.status === "confused")).toBe(true);
    expect(threatOnMainScheme(state)).toBe(0);
  });
});

describe("§3.2 the villain's activation with no villain in play", () => {
  it("is announced with no enemy: the interrupt puts a villain in and that villain's activation continues", () => {
    const state = start({ setAside: true });
    expect(undefeatedVillains(state)).toHaveLength(0);
    const { state: after, events, session } = villainPhase(state);
    expect(undefeatedVillains(after)).toHaveLength(1);
    expect(events.some((e) => e.type === "villainAdded")).toBe(true);
    const entered = undefeatedVillains(after)[0]!;
    const sch = entered.cardId === SCHEMING.id ? 2 : 3;
    expect(threatOnMainScheme(after)).toBe(sch);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
