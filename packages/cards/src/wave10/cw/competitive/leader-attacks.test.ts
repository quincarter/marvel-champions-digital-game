/**
 * Which abilities hear a leader attacking the other leader (docs/competitive-mode-plan.md §1.10 N11), on real cards in
 * the engine's two-team fixture (`packages/engine/src/testing/team.ts`): for p1, "your leader" is leader two, which
 * attacks leader one.
 *
 * Sources: N11 A per owner decision 2026-11-20 (the attacker's own "when/after [X] attacks" triggers fire; an attack
 * trigger is not an activation); MC56 p. 16 (no defender: defense-labelled abilities unusable, RRG v1.8 Defend p. 14),
 * p. 20 FAQ (Energy Channel fires on leader-vs-leader); RRG v1.8 Attack p. 8 ("attacks you" needs an attacked player).
 */

import { cardId, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, playerOf, type Picker } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";

vi.setConfig({ testTimeout: 120_000 });

const ENGINE_TESTING = new URL("../../../../../engine/src/testing/", import.meta.url).href;
interface Fixture {
  readonly competitiveGame: (options?: {
    readonly deps?: EngineDeps;
    readonly extraCards?: readonly AnyCard[];
    readonly encounterDecks?: readonly [readonly CardId[], readonly CardId[]];
    readonly deck?: readonly CardId[];
  }) => GameState;
}
interface Fixtures {
  readonly stubTreachery: (spec: { id: string; boostIcons?: number }) => AnyCard;
  readonly stubEvent: (spec: { id: string; cost?: number; abilities?: readonly { id: string }[] }) => AnyCard;
  readonly stubSupport: (spec: { id: string; cost: number; abilities?: readonly { id: string }[] }) => AnyCard;
}
interface Scenario {
  readonly DEFAULT_DECK: readonly CardId[];
}
const { competitiveGame } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}team.ts`)) as Fixture;
const { stubTreachery, stubEvent, stubSupport } = (await import(
  /* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`
)) as Fixtures;
const { DEFAULT_DECK } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}scenario.ts`)) as Scenario;

const P1 = "p1" as PlayerId;

const ENERGY_CHANNEL = "56098";
const SUPERHUMAN_STRENGTH = "57007";
const CUTS_BOTH_WAYS = "56050";

const NO_BOOST = stubTreachery({ id: "no-boost", boostIcons: 0 });

/** "Your leader attacks the enemy leader." */
const LEADER_ATTACK: AbilityDefinition = {
  trigger: { kind: "action" },
  effects: [
    { kind: "enemyAttacksEnemy", attacker: { kind: "leader", of: "yours" }, target: { kind: "leader", of: "enemy" } },
  ],
} as never;
const LEADER_ATTACK_CARD = stubEvent({ id: "leader-attack", cost: 0, abilities: [{ id: "leader-attack.action" }] });
/** "Forced Response: After an enemy attacks you, draw 1 card." (on a support) */
const ATTACKS_YOU: AbilityDefinition = {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", sourceIs: { categories: ["enemy"] }, playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
} as never;
const ATTACKS_YOU_CARD = stubSupport({ id: "attacks-you", cost: 0, abilities: [{ id: "attacks-you.response" }] });
/** "Forced Interrupt: When an enemy activates, draw 1 card." (an activation pattern) */
const ACTIVATES: AbilityDefinition = {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", sourceIs: { categories: ["enemy"] }, activation: true },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
} as never;
const ACTIVATES_CARD = stubSupport({ id: "activates", cost: 0, abilities: [{ id: "activates.interrupt" }] });

const real = (...codes: readonly string[]): readonly AnyCard[] =>
  codes.map((code) => WAVE10_CARDS.find((card) => (card.id as string) === code)!);

const deps: EngineDeps = {
  ...WAVE10_DEPS,
  abilities: {
    ...WAVE10_DEPS.abilities,
    "leader-attack.action": LEADER_ATTACK,
    "attacks-you.response": ATTACKS_YOU,
    "activates.interrupt": ACTIVATES,
  },
};

const EXTRA = [
  NO_BOOST,
  LEADER_ATTACK_CARD,
  ATTACKS_YOU_CARD,
  ACTIVATES_CARD,
  ...real(ENERGY_CHANNEL, SUPERHUMAN_STRENGTH, CUTS_BOTH_WAYS),
];
const fill = (cards: readonly string[]): CardId[] =>
  [...cards, ...Array.from({ length: 12 }, () => NO_BOOST.id as string)].map((code) => cardId(code));

function game(): GameState {
  return competitiveGame({
    deps,
    extraCards: EXTRA,
    encounterDecks: [fill([ENERGY_CHANNEL]), fill([SUPERHUMAN_STRENGTH])],
    deck: [
      ...DEFAULT_DECK,
      cardId(LEADER_ATTACK_CARD.id),
      cardId(CUTS_BOTH_WAYS),
      cardId(ATTACKS_YOU_CARD.id),
      cardId(ACTIVATES_CARD.id),
    ],
  });
}

const leaders = (state: GameState) => {
  const [one, two] = state.villains;
  return { one: one!.instanceId, two: two!.instanceId, deckOne: one!.encounterDeckId, deckTwo: two!.encounterDeckId };
};

/** Takes an encounter card out of deck `deckId` and attaches it to `host` (surgery). */
function attachFrom(
  state: GameState,
  deckId: string,
  code: string,
  host: InstanceId,
): { state: GameState; id: InstanceId } {
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code))!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: host, faceup: true },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Moves a card of p1's into their hand or play area (surgery). */
function moveP1(state: GameState, code: string, to: "hand" | "playArea"): { state: GameState; id: InstanceId } {
  const seat = playerOf(state, P1);
  const id = [...seat.hand, ...seat.deck, ...seat.discard].find((i) => state.instances[i]!.cardId === cardId(code))!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: [...p.hand.filter((i) => i !== id), ...(to === "hand" ? [id] : [])],
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              playArea: to === "playArea" ? [...p.playArea, id] : p.playArea,
            }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, ...(to === "playArea" ? { controllerId: P1, faceup: true } : {}) },
      },
    },
  };
}

/** Accepts every optional trigger offered. */
const acceptAll: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId as string);
  return firstLegal(s);
};

function setUp() {
  let state = game();
  const { one, two, deckOne, deckTwo } = leaders(state);
  const channel = attachFrom(state, deckOne, ENERGY_CHANNEL, one);
  state = channel.state;
  const strength = attachFrom(state, deckTwo, SUPERHUMAN_STRENGTH, two);
  state = strength.state;
  state = moveP1(state, CUTS_BOTH_WAYS, "hand").state;
  state = moveP1(state, ATTACKS_YOU_CARD.id, "playArea").state;
  state = moveP1(state, ACTIVATES_CARD.id, "playArea").state;
  const attack = moveP1(state, LEADER_ATTACK_CARD.id, "hand");
  const run = driveEventsPicking(deps, attack.state, acceptAll, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: attack.id,
    payment: [],
    attachToInstanceId: null,
  } as never);
  return { run, one, two, channel: channel.id, strength: strength.id };
}

const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && (e.abilityId as string) === abilityId).length;

describe("a leader attacking the other leader (N11; MC56 pp. 16, 20)", () => {
  const { run, one, two, channel, strength } = setUp();

  it("is made: leader two attacks leader one", () => {
    expect(
      run.events.some(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === two && e.targetInstanceId === one,
      ),
    ).toBe(true);
  });

  it("the attacker's own 'when [X] attacks' (Superhuman Strength) fires, and the card is discarded after the attack", () => {
    expect(resolved(run.events, "57007.superhuman-strength-forced-interrupt")).toBe(1);
    expect(inst(run.state, two).attachments).not.toContain(strength);
  });

  it("Energy Channel on the attacked leader fires: 'after a leader … attacks Captain Marvel' (MC56 p. 20 FAQ)", () => {
    expect(inst(run.state, channel).counters["energy"] ?? 0).toBe(1);
  });

  it("a defense-labelled ability (Cuts Both Ways) is not offered: the attack has no defender", () => {
    expect(resolved(run.events, "56050.cuts-both-ways-interrupt")).toBe(0);
  });

  it("'after an enemy attacks you' does not fire: no player is attacked", () => {
    expect(resolved(run.events, "attacks-you.response")).toBe(0);
  });

  it("'when an enemy activates' does not fire: an attack a card makes is not an activation", () => {
    expect(resolved(run.events, "activates.interrupt")).toBe(0);
  });
});
