/**
 * Energy Channel (56098) at 4 counters when "that character" is a leader: Captain Marvel's attack on it is a leader
 * attacking a leader (docs/competitive-mode-plan.md §1.10), on the engine's two-team fixture
 * (`packages/engine/src/testing/team.ts`). Energy Channel is on leader one (team one's area, a1); p1 plays "your leader
 * attacks the enemy leader", so leader two attacks leader one and the channel reaches 4.
 *
 * Sources: MC56 FAQ p. 20 (Energy Channel fires on a leader's attack, and she attacks that leader) + p. 16 (the
 * leader-attacks-leader steps: one boost card from the deck in the attacker's area, turned by the first player of the
 * team there, no defender); Choosing Sides 56128a ("the enemy leader cannot take more than 2 damage from each attack").
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
}
interface Scenario {
  readonly DEFAULT_DECK: readonly CardId[];
}
const { competitiveGame } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}team.ts`)) as Fixture;
const { stubTreachery, stubEvent } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`)) as Fixtures;
const { DEFAULT_DECK } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}scenario.ts`)) as Scenario;

const P1 = "p1" as PlayerId;

const ENERGY_CHANNEL = "56098";
const CHOOSING_SIDES = "56128a";

/** Leader one's deck: a boost card with 2 icons, so her attack is ATK 2 + 2 = 4. Leader two's: none. */
const TWO_BOOST = stubTreachery({ id: "two-boost", boostIcons: 2 });
const NO_BOOST = stubTreachery({ id: "no-boost", boostIcons: 0 });

/** "Your leader attacks the enemy leader." (no boost card, so only Captain Marvel's attack draws one) */
const LEADER_ATTACK: AbilityDefinition = {
  trigger: { kind: "action" },
  effects: [
    { kind: "enemyAttacksEnemy", attacker: { kind: "leader", of: "yours" }, target: { kind: "leader", of: "enemy" } },
  ],
} as never;
const LEADER_ATTACK_CARD = stubEvent({ id: "leader-attack", cost: 0, abilities: [{ id: "leader-attack.action" }] });

const real = (...codes: readonly string[]): readonly AnyCard[] =>
  codes.map((code) => WAVE10_CARDS.find((card) => (card.id as string) === code)!);

const deps: EngineDeps = {
  ...WAVE10_DEPS,
  abilities: { ...WAVE10_DEPS.abilities, "leader-attack.action": LEADER_ATTACK },
};

const fill = (first: string, filler: AnyCard): CardId[] =>
  [first, ...Array.from({ length: 12 }, () => filler.id as string)].map((code) => cardId(code));

function game(): GameState {
  return competitiveGame({
    deps,
    extraCards: [TWO_BOOST, NO_BOOST, LEADER_ATTACK_CARD, ...real(ENERGY_CHANNEL, CHOOSING_SIDES)],
    encounterDecks: [fill(ENERGY_CHANNEL, TWO_BOOST), fill(CHOOSING_SIDES, NO_BOOST)],
    deck: [...DEFAULT_DECK, cardId(LEADER_ATTACK_CARD.id)],
  });
}

/** Takes `code` out of the encounter deck of `area`'s leader. */
function fromDeck(state: GameState, area: 0 | 1, code: string) {
  const deckId = state.villains[area]!.encounterDeckId;
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code))!;
  const encounterDecks = { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } };
  return { id, deckId, encounterDecks };
}

/** Energy Channel on leader one with 3 energy counters, and, with `choosingSides`, Choosing Sides in leader two's area. */
function setUp(choosingSides: boolean) {
  let state = game();
  const one = state.villains[0]!.instanceId;
  const two = state.villains[1]!.instanceId;
  const channel = fromDeck(state, 0, ENERGY_CHANNEL);
  state = {
    ...state,
    encounterDecks: channel.encounterDecks,
    instances: {
      ...state.instances,
      [channel.id]: { ...state.instances[channel.id]!, attachedTo: one, faceup: true, counters: { energy: 3 } },
      [one]: { ...state.instances[one]!, attachments: [...state.instances[one]!.attachments, channel.id] },
    },
  };
  if (choosingSides) {
    const scheme = fromDeck(state, 1, CHOOSING_SIDES);
    state = {
      ...state,
      encounterDecks: scheme.encounterDecks,
      villainArea: [...state.villainArea, scheme.id],
      gameAreas: state.gameAreas.map((area, index) =>
        index === 1 ? { ...area, sideSchemeIds: [...area.sideSchemeIds, scheme.id] } : area,
      ),
      instances: { ...state.instances, [scheme.id]: { ...state.instances[scheme.id]!, threat: 4, faceup: true } },
    };
  }
  const seat = playerOf(state, P1);
  const card = seat.deck.find((i) => state.instances[i]!.cardId === cardId(LEADER_ATTACK_CARD.id))!;
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, card], deck: p.deck.filter((i) => i !== card) } : p,
    ),
  };
  const run = driveEventsPicking(
    deps,
    state,
    firstLegal as Picker,
    {
      type: "playCard",
      playerId: P1,
      cardInstanceId: card,
      payment: [],
      attachToInstanceId: null,
    } as never,
  );
  return { run, one, two, channel: channel.id, deckOne: channel.deckId };
}

const attacksBy = (events: readonly GameEvent[], attacker: InstanceId) =>
  events.filter((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === attacker);

describe("Energy Channel at 4 counters against a leader (MC56 FAQ p. 20, p. 16)", () => {
  const { run, one, two, channel, deckOne } = setUp(false);

  it("removes every counter, and Captain Marvel attacks the leader that attacked her", () => {
    expect(inst(run.state, channel).counters["energy"] ?? 0).toBe(0);
    expect(attacksBy(run.events, one).map((e) => e.type === "enemyAttackedEnemy" && e.targetInstanceId)).toEqual([two]);
  });

  it("is dealt one boost card from the deck in her area, turned by that team's first player", () => {
    const dealt = run.events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === one);
    expect(dealt).toHaveLength(1);
    const moved = run.events.find(
      (e) => e.type === "cardMoved" && dealt[0]?.type === "boostCardDealt" && e.instanceId === dealt[0].instanceId,
    );
    expect(moved).toMatchObject({ from: { kind: "encounterDeck", deckId: deckOne } });
    const turned = run.events.find(
      (e) => e.type === "triggerEvent" && e.event.kind === "boostCardTurnedFaceup" && e.event.enemyInstanceId === one,
    );
    expect(turned).toMatchObject({ event: { playerId: P1 } });
  });

  it("has no defender, and deals her ATK plus the boost (2 + 2) to the leader", () => {
    expect(run.events.some((e) => e.type === "defenderDeclared")).toBe(false);
    expect(inst(run.state, two).damage).toBe(4);
  });
});

describe("Energy Channel's attack on a leader under Choosing Sides (56128a): the cap still applies", () => {
  it("the leader in Choosing Sides' area takes no more than 2 from it", () => {
    const { run, one, two } = setUp(true);
    expect(attacksBy(run.events, one)).toHaveLength(1);
    expect(inst(run.state, two).damage).toBe(2);
  });
});
