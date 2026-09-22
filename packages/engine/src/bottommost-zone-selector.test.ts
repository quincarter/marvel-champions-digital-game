/**
 * docs/phase7-wave3.md §3.26 ("return the bottommost attack or thwart event from your discard pile to your hand",
 * Conditioning Room, `gam` 18008): `CardSelector.zone` gains `bottommostOnly`, the mirror of the existing
 * `topmostOnly` (proven elsewhere, `player-cards.test.ts`'s Stark Tower test) over the same array order — a
 * discard pile is prepended on discard (`ctx.ts`'s `moveCard`, "top" position), so its last element is the
 * genuinely oldest, physically bottommost card.
 */
import { flat, trait, type AnyCard, type CardId, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubIdentity, stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { ALLY, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const use = (id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [],
});
const ATTACK = trait("Attack");

const BLANK = stubEvent({ id: "blank", cost: 0 });
const ATTACK_EVENT: EventCard = { ...stubEvent({ id: "attack-event", cost: 0 }), traits: [ATTACK] };
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });

const returnBottommost = stubAbility(
  "return-bottommost",
  def({
    trigger: { kind: "action", form: "hero" },
    effects: [
      {
        kind: "moveCards",
        cards: {
          kind: "zone",
          zone: "discard",
          player: { kind: "controller" },
          filter: { categories: ["event"], trait: ATTACK },
          bottommostOnly: true,
        },
        to: "hand",
      },
    ],
  }),
);
const identity = stubIdentity({
  id: "gam-stub",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [returnBottommost.ref],
});

const CARDS: readonly AnyCard[] = [BLANK, ATTACK_EVENT, SCHEME, VILLAIN, identity];
const deps: EngineDeps = depsOf(returnBottommost);

function game(): GameState {
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: CARDS,
    deck: [...copies(BLANK.id, 4), ...copies(ATTACK_EVENT.id, 4), ...copies(RESOURCE.id, 8), ...copies(ALLY.id)],
    encounterDeck: copies(BLANK.id, 20),
    identity,
    deps,
  });
  return runWith(deps, state, toHero);
}

/** Puts `ids` into `player`'s discard pile, discarded in the given order: the first is discarded first, and so
 * ends up at the *end* of the array — the pile's own "prepend on discard" convention (`ctx.ts`'s `moveCard`, "top"
 * position) — which is the genuinely bottommost, oldest card. */
function arrangeDiscard(state: GameState, discardedInOrder: readonly InstanceId[]): GameState {
  let pile: readonly InstanceId[] = [];
  for (const id of discardedInOrder) pile = [id, ...pile];
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === p1 ? { ...p, hand: p.hand.filter((id) => !discardedInOrder.includes(id)), discard: pile } : p,
    ),
    instances: discardedInOrder.reduce(
      (acc, id) => ({ ...acc, [id]: { ...(state.instances[id] as CardInstance), faceup: true } }),
      state.instances,
    ),
  };
}

describe("CardSelector.zone's bottommostOnly (docs/phase7-wave3.md §3.26)", () => {
  it("returns the last matching card in the discard pile's own array order, not the most recently discarded", () => {
    const start = game();
    const given = giveCards(start, p1, "attack-event", "blank", "attack-event");
    const [firstAttack, blank, secondAttack] = given.ids as [InstanceId, InstanceId, InstanceId];
    const arranged = arrangeDiscard(given.state, [firstAttack, blank, secondAttack]);
    expect(mustPlayer(arranged, p1).discard).toEqual([secondAttack, blank, firstAttack]);

    const identityId = mustPlayer(arranged, p1).identity.instanceId;
    const after = runWith(deps, arranged, use(identityId, "return-bottommost"));
    expect(mustPlayer(after, p1).hand).toContain(firstAttack);
    expect(mustPlayer(after, p1).hand).not.toContain(secondAttack);
    expect(mustPlayer(after, p1).discard).toEqual([secondAttack, blank]);
  });
});
