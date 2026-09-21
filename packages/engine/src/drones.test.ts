import { activeEncounterDeck, activeVillain } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, trait, type CardId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, isMinion, mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, categoriesOf, traitsOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

// Facedown "as a Drone minion" cards and the base-stat overrides that give them stats.
const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };
const copies = (id: CardId, n = 20): readonly CardId[] => Array.from({ length: n }, () => id);
const DRONE = trait("Drone");
const asDrone = { kind: "minion", traits: [DRONE] } as const;
const facedownDrones = { categories: ["minion"], facedown: true, trait: DRONE } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

// "Each facedown Drone minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1."
const dronesEnv = stubAbility(
  "ultron-drones",
  def({
    trigger: {
      kind: "constant",
      modifiers: [
        { stat: "sch", amount: 1, setBase: true, target: facedownDrones },
        { stat: "atk", amount: 1, setBase: true, target: facedownDrones },
        { stat: "hp", amount: 1, setBase: true, target: facedownDrones },
      ],
    },
    effects: [],
  }),
);
const ENVIRONMENT = {
  ...stubTreachery({ id: "drones-env", boostIcons: 0 }),
  type: "environment" as const,
  name: "Ultron Drones",
  keywords: [{ name: "setup" as const }],
  abilities: [dronesEnv.ref],
};
// "Each player puts the top card of their deck into play facedown, engaged with them as a Drone minion."
const efficiency = stubAbility(
  "efficiency",
  def({
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "putIntoPlayFacedown", player: { kind: "each" }, as: asDrone }],
  }),
);
const EFFICIENCY = stubTreachery({ id: "efficiency", boostIcons: 0, abilities: [efficiency.ref] });
// A player card with its own ability — which must not be active while it is a facedown drone.
const loud = stubAbility(
  "loud",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 5, target: { categories: ["villain"] } }] },
    effects: [],
  }),
);
const LOUD = stubEvent({ id: "loud", cost: 0, abilities: [loud.ref] });

function start(
  extra: {
    encounter?: readonly CardId[];
    deck?: readonly CardId[];
    abilities?: readonly ReturnType<typeof stubAbility>[];
  } = {},
) {
  const deps = depsOf(dronesEnv, efficiency, loud, ...(extra.abilities ?? []));
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, ENVIRONMENT, EFFICIENCY, LOUD],
    deck: extra.deck ?? [...copies(LOUD.id, 10), ...copies(RESOURCE.id, 10)],
    encounterDeck: extra.encounter ?? [ENVIRONMENT.id, ...copies(EFFICIENCY.id, 20)],
    deps,
  });
  return { deps, state };
}
const dronesOf = (state: GameState) =>
  mustPlayer(state, p1).playArea.filter((id) => mustInstance(state, id).facedownAs !== null);
/** Round 1 in alter-ego: the setup-keyword environment is in play, the villain schemes, Android Efficiency is revealed. */
const afterRoundOne = (deps: ReturnType<typeof start>["deps"], state: GameState) =>
  settle(runWith(deps, state, endTurn), undefined, deps);

describe("facedown Drone minions (schema-free: `putIntoPlayFacedown`)", () => {
  it("is a minion engaged with that player, with only the Drone trait, no abilities of its own, and base stats from the environment", () => {
    const { deps, state } = start();
    expect(state.villainArea.some((id) => state.instances[id]?.cardId === ENVIRONMENT.id)).toBe(true);
    const roundTwo = afterRoundOne(deps, state);
    const [drone] = dronesOf(roundTwo) as [InstanceId];
    expect(drone).toBeDefined();
    const instance = mustInstance(roundTwo, drone);
    expect([instance.faceup, instance.engagedWith, instance.controllerId]).toEqual([false, p1, null]);
    expect(isMinion(roundTwo, drone)).toBe(true);
    expect(categoriesOf(roundTwo, drone)).toEqual(["minion", "enemy", "character"]);
    expect(traitsOf(roundTwo, drone, deps)).toEqual([DRONE]);
    expect(activeAbilityRefs(roundTwo, drone)).toEqual([]);
    const profile = characterProfile(roundTwo, drone, deps);
    expect([profile?.atk, profile?.sch, profile?.maxHp]).toEqual([1, 1, 1]);
    // The facedown card's own "+5 villain ATK" text is blank.
    expect(characterProfile(roundTwo, activeVillain(roundTwo).instanceId, deps)?.atk).toBe(0);
  });

  it("activates like any minion (alter-ego: schemes for its SCH)", () => {
    const { deps, state } = start();
    const roundTwo = afterRoundOne(deps, state);
    const threatBefore = mustInstance(roundTwo, roundTwo.mainScheme.instanceId).threat;
    const drones = dronesOf(roundTwo).length;
    const roundThree = settle(runWith(deps, roundTwo, endTurn), undefined, deps);
    // Villain SCH 0; each drone engaged at the start of that villain phase schemes for 1.
    expect(mustInstance(roundThree, roundThree.mainScheme.instanceId).threat).toBe(threatBefore + drones);
  });

  it("is defeated like a minion and goes to its owner's discard pile, faceup again", () => {
    const blast = stubAbility(
      "blast",
      def({
        trigger: { kind: "action" },
        effects: [
          { kind: "dealDamage", target: { kind: "each", query: facedownDrones }, amount: { kind: "const", value: 1 } },
        ],
      }),
    );
    const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [blast.ref] });
    const deps = depsOf(dronesEnv, efficiency, loud, blast);
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, ENVIRONMENT, EFFICIENCY, LOUD, BLAST],
      deck: [...copies(BLAST.id, 10), ...copies(LOUD.id, 10)],
      encounterDeck: [ENVIRONMENT.id, ...copies(EFFICIENCY.id, 20)],
      deps,
    });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [drone] = dronesOf(roundTwo) as [InstanceId];
    const blastId = mustPlayer(roundTwo, p1).hand.find(
      (id) => roundTwo.instances[id]?.cardId === BLAST.id,
    ) as InstanceId;
    const after = runWith(deps, roundTwo, toHero, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: blastId,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustPlayer(after, p1).discard).toContain(drone);
    expect(activeEncounterDeck(after).discard).not.toContain(drone);
    expect(mustInstance(after, drone).facedownAs).toBeNull();
    expect(mustInstance(after, drone).faceup).toBe(true);
  });

  it("'Each facedown Drone minion gets +1 ATK and +1 hit point' (Upgraded Drones, attached to the environment) adds to the base", () => {
    const upgraded = stubAbility(
      "upgraded",
      def({
        trigger: {
          kind: "constant",
          modifiers: [
            { stat: "atk", amount: 1, target: facedownDrones },
            { stat: "hp", amount: 1, target: facedownDrones },
          ],
        },
        effects: [],
      }),
    );
    const UPGRADED = stubAttachment({
      id: "upgraded",
      attachesTo: { kind: "namedCard", name: "Ultron Drones" },
      keywords: [{ name: "setup" }],
      abilities: [upgraded.ref],
    });
    const deps = depsOf(dronesEnv, efficiency, loud, upgraded);
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, ENVIRONMENT, EFFICIENCY, LOUD, UPGRADED],
      deck: copies(LOUD.id),
      encounterDeck: [ENVIRONMENT.id, UPGRADED.id, ...copies(EFFICIENCY.id, 20)],
      deps,
    });
    const env = state.villainArea.find((id) => state.instances[id]?.cardId === ENVIRONMENT.id) as InstanceId;
    // Setup puts setup-keyword cards into play in encounter-deck order; the attachment needs its host first.
    const upgradedId = Object.values(state.instances).find((i) => i.cardId === UPGRADED.id)?.instanceId as InstanceId;
    const attached: GameState = mustInstance(state, env).attachments.includes(upgradedId)
      ? state
      : {
          ...state,
          encounterDecks: withEncounterPiles(state, {
            deck: activeEncounterDeck(state).deck.filter((id) => id !== upgradedId),
            discard: activeEncounterDeck(state).discard.filter((id) => id !== upgradedId),
          }).encounterDecks,
          instances: {
            ...state.instances,
            [upgradedId]: { ...mustInstance(state, upgradedId), attachedTo: env, faceup: true },
            [env]: { ...mustInstance(state, env), attachments: [...mustInstance(state, env).attachments, upgradedId] },
          },
        };
    const roundTwo = settle(runWith(deps, attached, endTurn), undefined, deps);
    const [drone] = dronesOf(roundTwo) as [InstanceId];
    const profile = characterProfile(roundTwo, drone, deps);
    expect([profile?.atk, profile?.maxHp]).toEqual([2, 2]);
  });

  it("an empty deck resets first (discard reshuffled, a facedown encounter card dealt), then the drone comes from the new deck", () => {
    const { deps, state } = start();
    // Test surgery: empty the deck into the discard pile before the villain phase.
    const emptied: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1 ? { ...p, deck: [], discard: [...p.deck, ...p.discard] } : p,
      ),
    };
    const result = runWith(deps, emptied, endTurn);
    const settled = settle(result, undefined, deps);
    expect(dronesOf(settled).length).toBeGreaterThan(0);
    expect(mustPlayer(settled, p1).discard.length).toBeLessThan(mustPlayer(emptied, p1).discard.length);
  });
});

test("facedown drones replay to an identical state", () => {
  const { deps, state } = start();
  let session: GameSession = startSession(state);
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  const drain = () => {
    for (let choice = session.state.pendingChoice; choice; choice = session.state.pendingChoice) {
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
      });
    }
  };
  apply(endTurn);
  drain();
  apply(endTurn);
  drain();
  expect(dronesOf(session.state).length).toBeGreaterThan(0);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});
