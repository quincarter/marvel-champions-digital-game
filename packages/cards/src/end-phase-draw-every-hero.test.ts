/**
 * Issue #150: Iron Man + Black Panther vs Ultron, Black Panther first player. At the end of round 1 Black Panther
 * drew up and Iron Man stayed at 1 card. Not a missed draw: Iron Man's hero side prints hand size 1 and gets +1 per
 * Tech upgrade he controls (max 7), so with none out a hand of 1 is full. These tests pin both halves: every hero
 * refills to their hand size at the end of the player phase (RRG 1.8 "End of Player Phase", p. 18, step 2), in a
 * two-player game, whichever seat is first player; and the engine says so for each player, a full hand too
 * (`handRefilled`), so the log can tell a full hand from a missed draw.
 */
import {
  CORE_STARTER_DECKS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
  WAVE9_STARTER_DECKS,
  WAVE10_STARTER_DECKS,
  type StarterDeck,
} from "@mc/content";
import {
  applyCommand,
  createGame,
  handSize,
  outstandingForcedActions,
  playerOrder,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "./playable/index.js";
import { applyOk, firstLegal, moveToHand, settle } from "./testing/harness.js";

const DEPS = PLAYABLE_DEPS;

/** One starter deck per hero identity, in pack order. */
const HEROES: readonly StarterDeck[] = (() => {
  const seen = new Set<string>();
  const decks: StarterDeck[] = [];
  for (const deck of [
    ...CORE_STARTER_DECKS,
    ...WAVE1_STARTER_DECKS,
    ...WAVE2_STARTER_DECKS,
    ...WAVE3_STARTER_DECKS,
    ...WAVE4_STARTER_DECKS,
    ...WAVE5_STARTER_DECKS,
    ...WAVE6_STARTER_DECKS,
    ...WAVE7_STARTER_DECKS,
    ...WAVE8_STARTER_DECKS,
    ...WAVE9_STARTER_DECKS,
    ...WAVE10_STARTER_DECKS,
  ]) {
    if (seen.has(deck.identityCardId)) continue;
    seen.add(deck.identityCardId);
    decks.push(deck);
  }
  return decks;
})();

const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";

function startGame(scenarioId: string, starterDeckIds: readonly string[], firstPlayerIndex: number): GameState {
  const config = playableScenario(scenarioId, {
    players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })),
    seed: 150,
    firstPlayerIndex,
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Every hand goes to the bottom of its deck, so the end-of-phase draw has a whole hand size to fill. */
function emptyHands(state: GameState): GameState {
  return { ...state, players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.deck, ...p.hand] })) };
}

/** Ends every turn of the player phase (answering prompts with `firstLegal`) through the end-of-phase draw. */
function endPlayerPhase(initial: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let state = initial;
  const events: GameEvent[] = [];
  const refills = () => events.filter((e) => e.type === "handRefilled").length;
  for (let guard = 0; refills() < playerOrder(initial).length; guard++) {
    if (guard > 200) throw new Error(`the player phase did not end (${state.step.phase}/${state.step.kind})`);
    if (state.outcome) throw new Error(`the game ended before the end-of-phase draw`);
    let command: Command;
    const choice = state.pendingChoice;
    if (choice) {
      command = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(state),
      };
    } else if (state.step.phase === "player" && state.step.kind === "turn") {
      const active = state.step.activePlayerId;
      command = outstandingForcedActions(state, active, DEPS)[0]?.example ?? { type: "endTurn", playerId: active };
    } else throw new Error(`no choice and no turn (${state.step.phase}/${state.step.kind})`);
    const result = applyOk(state, command, DEPS);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

function refills(events: readonly GameEvent[]) {
  return events.flatMap((e) => (e.type === "handRefilled" ? [e] : []));
}

describe("the end-of-phase draw refills every hero in a two-player game (issue #150)", () => {
  for (const hero of HEROES) {
    const partner = hero.id === BLACK_PANTHER ? SPIDER_MAN : BLACK_PANTHER;
    for (const firstPlayerIndex of [0, 1]) {
      it(`${hero.id} with ${partner}, ${firstPlayerIndex === 0 ? "first" : "second"} player`, () => {
        const start = emptyHands(startGame("rhino", [hero.id, partner], firstPlayerIndex));
        const order = playerOrder(start).map((p) => p.playerId);
        const sizes = new Map<PlayerId, number>(order.map((id) => [id, handSize(start, id, DEPS)]));

        const drawn = refills(endPlayerPhase(start).events);

        // One per player, in player order: the first player first.
        expect(drawn.map((e) => e.playerId)).toEqual(order);
        for (const event of drawn) {
          expect(event.handSize, event.playerId).toBe(sizes.get(event.playerId));
          // An empty hand draws its whole hand size (an obligation drawn on the way counts as drawn, never as held).
          expect(event.drawn, event.playerId).toBeGreaterThanOrEqual(event.handSize);
        }
      });
    }
  }
});

describe("Iron Man's hand size of 1 is a full hand, not a missed draw (issue #150)", () => {
  const IRON_MAN = "core-iron-man-aggression";

  for (const firstPlayerIndex of [0, 1]) {
    it(`Black Panther and Iron Man vs Ultron, ${firstPlayerIndex === 0 ? "Black Panther" : "Iron Man"} first`, () => {
      let state = startGame("ultron", [BLACK_PANTHER, IRON_MAN], firstPlayerIndex);
      const [panther, ironMan] = state.players.map((p) => p.playerId) as [PlayerId, PlayerId];
      // Iron Man in hero form with no Tech upgrade out, holding one card; Black Panther with an empty hand.
      state = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === ironMan
            ? {
                ...p,
                identity: { ...p.identity, form: "hero" },
                hand: p.hand.slice(0, 1),
                deck: [...p.deck, ...p.hand.slice(1)],
              }
            : { ...p, hand: [], deck: [...p.deck, ...p.hand] },
        ),
      };
      expect(handSize(state, ironMan, DEPS)).toBe(1);
      const pantherSize = handSize(state, panther, DEPS);

      const ended = endPlayerPhase(state);

      expect(refills(ended.events)).toEqual(
        playerOrder(state).map((p) =>
          p.playerId === ironMan
            ? { type: "handRefilled", playerId: ironMan, drawn: 0, handSize: 1 }
            : { type: "handRefilled", playerId: panther, drawn: pantherSize, handSize: pantherSize },
        ),
      );
    });
  }
});

describe("Iron Man's hand size counts every Tech upgrade he plays (issue #140, issue #150)", () => {
  // Arc Reactor, Mark V Armor, Mark V Helmet, Powered Gauntlets x2, Rocket Boots x2: his kit's seven Tech upgrades.
  const TECH = ["01035", "01036", "01037", "01038", "01038", "01039", "01039"] as const;

  it("1 with none, +1 per upgrade played, 7 with all seven; the end-of-phase draw fills all 7", () => {
    let state = startGame("rhino", ["core-iron-man-aggression"], 0);
    const me = state.players[0]!.playerId;
    state = applyOk(state, { type: "changeForm", playerId: me }, DEPS).state;
    state = settle(state, firstLegal, undefined, DEPS);
    const moved = moveToHand(state, me, ...TECH);
    state = moved.state;
    // Payment: every other card goes to hand, so each upgrade can be paid for out of it.
    state = {
      ...state,
      players: state.players.map((p) => (p.playerId === me ? { ...p, hand: [...p.hand, ...p.deck], deck: [] } : p)),
    };
    expect(handSize(state, me, DEPS)).toBe(1);

    const sizes: number[] = [];
    for (const upgrade of moved.ids) {
      state = playPayingFromHand(state, me, upgrade, moved.ids);
      sizes.push(handSize(state, me, DEPS));
    }
    expect(sizes).toEqual([2, 3, 4, 5, 6, 7, 7]);

    // Back to an empty hand with a full deck: the end-of-phase draw takes him to 7.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === me ? { ...p, hand: [], deck: [...p.hand, ...p.discard], discard: [] } : p,
      ),
    };
    expect(refills(endPlayerPhase(state).events)).toEqual([
      { type: "handRefilled", playerId: me, drawn: 7, handSize: 7 },
    ]);
  });
});

/** Plays `id` (attached to the identity when the card asks for a host), paying with the fewest other hand cards. */
function playPayingFromHand(
  state: GameState,
  player: PlayerId,
  id: InstanceId,
  keep: readonly InstanceId[],
): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const spare = owner.hand.filter((card) => card !== id && !keep.includes(card));
  for (const attach of [null, owner.identity.instanceId]) {
    for (let count = 0; count <= 6; count++) {
      const result = applyCommand(
        state,
        {
          type: "playCard",
          playerId: player,
          cardInstanceId: id,
          payment: spare.slice(0, count).map((fromHand) => ({ fromHand })),
          attachToInstanceId: attach,
        },
        DEPS,
      );
      if (result.ok) return settle(result.state, firstLegal, undefined, DEPS);
    }
  }
  throw new Error(`could not play ${state.instances[id]?.cardId}`);
}
