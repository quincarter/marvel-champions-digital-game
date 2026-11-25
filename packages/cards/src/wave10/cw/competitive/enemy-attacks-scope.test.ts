/**
 * Which team hears a leader attacking the other leader as "an enemy attacks" (docs/competitive-mode-plan.md §1.10 N11),
 * on real cards in the engine's two-team fixture (`packages/engine/src/testing/team.ts`): p1 (team one) plays "your
 * leader attacks the enemy leader", so leader two, in team two's area, attacks leader one, team two's own leader.
 *
 * Sources: MC56 p. 16 ("enemy" is the leader you are fighting and the minions on your side; the attack's steps, with
 * its boost card from the deck in the attacker's area); N11 A per owner decision 2026-11-20 (defense-labelled and
 * "attacks you" abilities are excluded: `leader-attacks.test.ts`); Q11 A (the inactive team's triggered abilities fire).
 */

import { cardId, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_DEPS } from "../../../playable/index.js";
import { firstLegal, inst, type Picker } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";

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
const P2 = "p2" as PlayerId;

const GAMBITS_STAFF = "37004";
const SUBDUE = "19018";
const WEBBED_UP = "01009";
const PHASED_AND_CONFUSED = "32036";

const STAFF_ABILITY = "37004.gambits-staff-interrupt";
const SUBDUE_ABILITY = "19018.subdue-interrupt";

/** A boost card with one icon, so a dealt boost would show in the damage. */
const ONE_BOOST = stubTreachery({ id: "one-boost", boostIcons: 1 });

/** "Your leader attacks the enemy leader", dealt a boost card (as Whatever It Takes 56126). */
const LEADER_ATTACK: AbilityDefinition = {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "enemyAttacksEnemy",
      attacker: { kind: "leader", of: "yours" },
      target: { kind: "leader", of: "enemy" },
      boost: true,
    },
  ],
} as never;
const LEADER_ATTACK_CARD = stubEvent({ id: "leader-attack", cost: 0, abilities: [{ id: "leader-attack.action" }] });

const real = (...codes: readonly string[]): readonly AnyCard[] =>
  codes.map((code) => PLAYABLE_CARDS.find((card) => (card.id as string) === code)!);

const deps: EngineDeps = {
  ...PLAYABLE_DEPS,
  abilities: { ...PLAYABLE_DEPS.abilities, "leader-attack.action": LEADER_ATTACK },
};

function game(): GameState {
  const boosts = Array.from({ length: 12 }, () => cardId(ONE_BOOST.id));
  return competitiveGame({
    deps,
    extraCards: [ONE_BOOST, LEADER_ATTACK_CARD, ...real(GAMBITS_STAFF, SUBDUE, WEBBED_UP, PHASED_AND_CONFUSED)],
    encounterDecks: [boosts, boosts],
    deck: [
      ...DEFAULT_DECK,
      cardId(LEADER_ATTACK_CARD.id),
      ...[GAMBITS_STAFF, SUBDUE, WEBBED_UP, PHASED_AND_CONFUSED].map(cardId),
    ],
  });
}

const leaders = (state: GameState) => ({ one: state.villains[0]!.instanceId, two: state.villains[1]!.instanceId });

/** Moves a card of `player`'s into their hand, play area, or onto `host` as their attachment (surgery). */
function move(
  state: GameState,
  player: PlayerId,
  code: string,
  to: "hand" | "playArea" | { readonly host: InstanceId },
): { state: GameState; id: InstanceId } {
  const seat = state.players.find((p) => p.playerId === player)!;
  const id = [...seat.hand, ...seat.deck, ...seat.discard].find((i) => state.instances[i]!.cardId === cardId(code))!;
  const host = typeof to === "object" ? to.host : null;
  const instances = {
    ...state.instances,
    [id]: {
      ...state.instances[id]!,
      ...(to === "hand" ? {} : { controllerId: player, faceup: true }),
      ...(host ? { attachedTo: host } : {}),
    },
  };
  if (host) instances[host] = { ...instances[host]!, attachments: [...instances[host]!.attachments, id] };
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: [...p.hand.filter((i) => i !== id), ...(to === "hand" ? [id] : [])],
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              playArea: to === "playArea" ? [...p.playArea, id] : p.playArea,
            }
          : p,
      ),
      instances,
    },
  };
}

/** Accepts every optional trigger offered, paying a card's cost with the first card offered. */
const acceptAll: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId as string);
  if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId as string];
  return firstLegal(s);
};

/** p1 plays the leader attack: leader two attacks leader one. */
function attack(state: GameState) {
  const card = move(state, P1, LEADER_ATTACK_CARD.id, "hand");
  return driveEventsPicking(deps, card.state, acceptAll, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: card.id,
    payment: [],
    attachToInstanceId: null,
  } as never);
}

const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && (e.abilityId as string) === abilityId).length;
const offered = (events: readonly GameEvent[], abilityId: string) =>
  events.some(
    (e) =>
      e.type === "choiceRequested" &&
      e.choice.prompt.kind === "chooseTriggers" &&
      JSON.stringify(e.choice.options).includes(abilityId),
  );

/** Gambit's Staff in play and Subdue in hand for `player`, in hero form (both are Hero Interrupts). */
function withInterrupts(player: PlayerId): GameState {
  const start = game();
  let state: GameState = {
    ...start,
    players: start.players.map((p) =>
      p.playerId === player ? { ...p, identity: { ...p.identity, form: "hero", heroFormIndex: 0 } } : p,
    ),
  };
  state = move(state, player, GAMBITS_STAFF, "playArea").state;
  return move(state, player, SUBDUE, "hand").state;
}

describe("'when an enemy attacks' hears a leader attacking a leader only on the attacked leader's team (MC56 p. 16)", () => {
  it("the defending team (whose area holds the attacker): Gambit's Staff and Subdue are offered and resolve", () => {
    const run = attack(withInterrupts(P2));
    const { two } = leaders(run.state);
    expect(resolved(run.events, STAFF_ABILITY)).toBe(1);
    expect(resolved(run.events, SUBDUE_ABILITY)).toBe(1);
    // Gambit's Staff's 1 damage goes to "that enemy", the attacking leader; Subdue's -3 ATK leaves 2 ATK + 1 boost at 0.
    expect(inst(run.state, two).damage).toBe(1);
    expect(run.events).toContainEqual(expect.objectContaining({ type: "enemyAttackedEnemy", damageDealt: 0 }));
  });

  it("the attacking team never hears it: the same cards for p1 are not offered", () => {
    const run = attack(withInterrupts(P1));
    expect(offered(run.events, STAFF_ABILITY)).toBe(false);
    expect(offered(run.events, SUBDUE_ABILITY)).toBe(false);
    expect(resolved(run.events, STAFF_ABILITY) + resolved(run.events, SUBDUE_ABILITY)).toBe(0);
    // The attack itself is made.
    expect(run.events.some((e) => e.type === "enemyAttackedEnemy" && e.skipped === undefined)).toBe(true);
  });
});

describe.each([
  { name: "Webbed Up", code: WEBBED_UP, ability: "01009.webbed-up-forced-interrupt", status: "stunned" },
  {
    name: "Phased and Confused",
    code: PHASED_AND_CONFUSED,
    ability: "32036.phased-and-confused-forced-interrupt",
    status: "confused",
  },
])("$name on the attacking leader (a replacement: 'when attached enemy would attack')", ({ code, ability, status }) => {
  const start = game();
  const { two } = leaders(start);
  const attached = move(start, P2, code, { host: two });
  const run = attack(attached.state);

  it("fires, is discarded and gives its status", () => {
    expect(resolved(run.events, ability)).toBe(1);
    expect(inst(run.state, two).attachments).not.toContain(attached.id);
    expect(JSON.stringify(inst(run.state, two))).toContain(status);
  });

  it("the attack never starts: no boost card is dealt and no damage is dealt", () => {
    expect(run.events.some((e) => e.type === "boostCardDealt")).toBe(false);
    expect(run.events.some((e) => e.type === "enemyAttackedEnemy" && e.damageDealt > 0)).toBe(false);
    expect(inst(run.state, leaders(run.state).one).damage).toBe(0);
  });
});
