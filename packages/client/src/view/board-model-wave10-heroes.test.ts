/**
 * Hulkling and Tigra on the board (docs/phase7-wave10-client.md C15, sections 5.6 and 8). Real games from the starter
 * decks the pool carries, with the pieces of state the engine's own tests reach by play patched in as the engine leaves
 * them: a Shapeshift upgrade in play, Alien Physiology in play, cards tucked under a scheme.
 */
import { applyCommand, legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { boardModel } from "./board-model.js";
import { noTargetTag } from "./hand-reason.js";
import { beginPayment, paymentView } from "./payment-model.js";
import { searchedPickFor } from "./play-aim.js";
import { logLine } from "./log-lines.js";

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

function settle(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 60 && current.pendingChoice; guard++) {
    const choice = current.pendingChoice;
    current = run(current, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  return current;
}

async function started(deck: string, seed = 5): Promise<{ state: GameState; me: PlayerId }> {
  const core = new EngineSessionCore();
  const result = await core.start({
    scenarioId: "registration-iron-man",
    difficulty: "standard",
    players: [{ starterDeckId: deck }],
    seed,
  });
  const state = settle({ ...result.snapshot.state, cardPool: result.cardPool } as GameState);
  return { state, me: state.players[0]!.playerId };
}

const findCard = (state: GameState, code: string): InstanceId => {
  const seat = state.players[0]!;
  const found = [...seat.hand, ...seat.deck, ...seat.discard].find((id) => state.instances[id]?.cardId === code);
  if (!found) throw new Error(`no ${code} in the deck`);
  return found;
};

/** `id` moved to the front of the hand. */
const inHand = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  players: state.players.map((seat, at) =>
    at === 0
      ? {
          ...seat,
          hand: [id, ...seat.hand.filter((entry) => entry !== id)],
          deck: seat.deck.filter((entry) => entry !== id),
          discard: seat.discard.filter((entry) => entry !== id),
        }
      : seat,
  ),
});

/** `id` in play as an upgrade on the seat's identity, ready, as the engine leaves one. */
const attachedToIdentity = (state: GameState, id: InstanceId): GameState => {
  const seat = state.players[0]!;
  const identity = seat.identity.instanceId;
  const instances = {
    ...state.instances,
    [id]: {
      ...state.instances[id]!,
      attachedTo: identity,
      faceup: true,
      exhausted: false,
      controllerId: seat.playerId,
    },
    [identity]: { ...state.instances[identity]!, attachments: [...state.instances[identity]!.attachments, id] },
  };
  return {
    ...state,
    instances,
    players: state.players.map((entry, at) =>
      at === 0
        ? {
            ...entry,
            hand: entry.hand.filter((x) => x !== id),
            deck: entry.deck.filter((x) => x !== id),
            discard: entry.discard.filter((x) => x !== id),
          }
        : entry,
    ),
  } as GameState;
};

describe("Hulkling: a second Shapeshift upgrade is refused with the engine's own sentence", () => {
  let table: { state: GameState; me: PlayerId };
  beforeAll(async () => {
    table = await started("hulkling-protection");
  }, 60_000);

  test("Teddy Altman's refusal reads as the card's unavailable reason, and Inspect keeps the full sentence", () => {
    let { state } = table;
    const winged = findCard(state, "56032");
    const hulk = findCard(state, "56033");
    state = attachedToIdentity(inHand(state, winged), hulk);
    const legal = legalActions(state, table.me, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
    const refused = legal.illegal.find(
      (entry) => entry.action.kind === "playCard" && entry.action.instanceId === winged,
    );
    expect(refused?.message).toBe("Teddy Altman: Winged Shape cannot enter play");
    expect(noTargetTag(refused!.message)).toBe("can't enter play");
  });
});

describe("Tigra: Hunted's minion pick is a list with the area of each candidate", () => {
  test("lists the engine's candidates by name and area, and a lone candidate is no question", async () => {
    const { state, me } = await started("tigra-aggression");
    const hunted = findCard(state, "56007");
    const seated = run(inHand(state, hunted), { type: "changeForm", playerId: me });
    const legal = legalActions(seated, me, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === hunted);
    expect(entry).toBeDefined();
    const pick = searchedPickFor(seated, POOL_DEPS, entry!);
    expect(pick).not.toBeNull();
    expect(pick!.prompt).toBe("Hunted: choose the minion to search for and attach it to");
    expect(pick!.options.map((option) => option.instanceId)).toEqual(entry!.targets);
    for (const option of pick!.options) {
      expect(option.label).toMatch(/ - in the encounter (deck|discard)( \(\d\))?$/);
      expect(option.area).toMatch(/^in the encounter (deck|discard)$/);
      // The sheet shows the printed face, an area tag in words, and the card id Inspect opens.
      expect(option.areaTag).toBe(option.area === "in the encounter deck" ? "ENCOUNTER DECK" : "ENCOUNTER DISCARD");
      expect(option.typeWord).toBe("Minion");
      // A card listed more than once says which copy it is; a unique one says nothing.
      const same = pick!.options.filter(
        (other) => other.label.replace(/ (d)$/, "") === option.label.replace(/ (d)$/, ""),
      );
      expect(option.copy === null).toBe(same.length === 1);
      expect(option.cardId).toBe(state.instances[option.instanceId]!.cardId);
    }
    // Two candidates that read the same are told apart by number.
    const labels = pick!.options.map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
    // An ordinary upgrade has no such list.
    const other = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId !== hunted);
    if (other) expect(searchedPickFor(seated, POOL_DEPS, other)).toBeNull();
  }, 60_000);

  test("a hostless Hunted is worded in the log", async () => {
    const { state, me } = await started("tigra-aggression");
    // Discarded, so faceup in the discard pile when the line is read.
    const hunted = findCard(state, "56007");
    const shown: GameState = {
      ...state,
      instances: { ...state.instances, [hunted]: { ...state.instances[hunted]!, faceup: true } },
    };
    expect(
      logLine({ type: "playedUpgradeHasNoHost", instanceId: hunted, playerId: me }, shown, me, POOL_DEPS)?.text,
    ).toBe("Hunted has nothing to attach to, so it is discarded. What was paid stays paid.");
  }, 60_000);
});

describe("Hulkling: Alien Physiology generates what the card being paid for is worth", () => {
  test("the payment strip shows a different amount for a Hulkling card and for another", async () => {
    const { state: begun, me } = await started("hulkling-protection");
    const alien = findCard(begun, "56036");
    const kin = findCard(begun, "56033"); // Hulk Shape, a Hulkling card
    const other = [...begun.players[0]!.deck, ...begun.players[0]!.hand].find((id) => {
      const code = begun.instances[id]!.cardId;
      return code !== "56036" && code !== "56033" && begun.cardPool[code]?.type !== "hero_identity";
    })!;
    let state = attachedToIdentity(begun, alien);
    state = {
      ...state,
      players: state.players.map((seat) => ({
        ...seat,
        hand: [kin, other, ...seat.hand.filter((x) => x !== kin && x !== other)],
      })),
    };
    // Alien Physiology is a support in the engine's data: place it in the play area rather than on the identity.
    const support = state.cardPool[state.instances[alien]!.cardId]!;
    if (support.type === "support") {
      state = {
        ...state,
        instances: {
          ...state.instances,
          [alien]: { ...state.instances[alien]!, attachedTo: null },
          [state.players[0]!.identity.instanceId]: {
            ...state.instances[state.players[0]!.identity.instanceId]!,
            attachments: state.instances[state.players[0]!.identity.instanceId]!.attachments.filter((x) => x !== alien),
          },
        },
        players: state.players.map((seat, at) => (at === 0 ? { ...seat, playArea: [...seat.playArea, alien] } : seat)),
      } as GameState;
    }
    const amounts = (card: InstanceId): number[] => {
      const payment = beginPayment(state, me, { kind: "playCard", instanceId: card }, null, POOL_DEPS);
      if (!payment) return [];
      const view = paymentView(state, me, payment, "x", POOL_DEPS);
      return view.sources
        .filter((source) => source.instanceId === alien)
        .map((source) => Object.values(source.pool).reduce((a, b) => a + b, 0));
    };
    const forKin = amounts(kin);
    const forOther = amounts(other);
    expect(forKin.length).toBeGreaterThan(0);
    expect(forOther.length).toBeGreaterThan(0);
    expect(Math.max(...forKin)).toBeGreaterThan(Math.max(...forOther));
  }, 60_000);
});

describe("Hulkling: cards put facedown under a scheme by Skrull Business", () => {
  test("the main scheme panel counts them as tucked cards, facedown and never named", async () => {
    const { state, me } = await started("hulkling-protection");
    const [first, second] = state.players[0]!.deck.slice(0, 2) as [InstanceId, InstanceId];
    const scheme = state.mainScheme.instanceId;
    const tucked: GameState = {
      ...state,
      players: state.players.map((seat) => ({
        ...seat,
        deck: seat.deck.filter((id) => id !== first && id !== second),
      })),
      instances: {
        ...state.instances,
        [scheme]: { ...state.instances[scheme]!, tucked: [first, second] },
        [first]: { ...state.instances[first]!, faceup: false },
        [second]: { ...state.instances[second]!, faceup: false },
      },
    };
    const panel = boardModel(tucked, me, POOL_DEPS).mainScheme;
    expect(panel.tuckedCount).toBe(2);
    expect(panel.tucked.map((card) => card.name)).toEqual(["Facedown card", "Facedown card"]);
    expect(panel.tucked.every((card) => !card.faceup && card.art === null)).toBe(true);
    expect(panel.tuckedLabel).toBe("Under this scheme: 2, 2 facedown");
  }, 60_000);

  test("the log words a deck discard that a card took and still counts", async () => {
    const { state, me } = await started("hulkling-protection");
    const [a, b] = state.players[0]!.deck.slice(0, 2) as [InstanceId, InstanceId];
    const name = (id: InstanceId) => state.cardPool[state.instances[id]!.cardId]!.name;
    const shown: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [a]: { ...state.instances[a]!, faceup: false },
        [b]: { ...state.instances[b]!, faceup: true },
      },
    };
    const text = logLine(
      { type: "deckDiscardStillCounted", playerId: me, instanceId: a, slot: "s", takenByInstanceId: b },
      shown,
      me,
      POOL_DEPS,
    )?.text;
    // The milled card is facedown under the scheme by then; the card that took it is faceup in play.
    expect(text).toBe(`A facedown card was taken by ${name(b)} and still counts as discarded.`);
  }, 60_000);
});
