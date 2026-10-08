import { abilityId, cardId, CORE_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  defineAbilities,
  dealDamage,
  forcedResponse,
  mergeRegistries,
  on,
  placeThreat,
  theMainScheme,
  varOf,
  yourIdentity,
} from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  playerOf,
  runWith,
  settle,
  use,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGNETIC_PULL_MOMENT, MAGNETIC_PULL_USED_MOMENT, MAGNETO_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magneto / Erik Lehnsherr (49001a/b), docs/phase7-wave8.md section 7.5, 3.71, Q41 and Q42. His real starter deck
 * (`magneto-leadership`) against Rhino. Hero face: THW 2, ATK 2, DEF 2, hand size 5, 10 hit points; alter-ego face: REC
 * 3, hand size 6. Armor, Cape and Old Grievances are other modules' cards: a fixture support (99002) stands in for
 * them, with a Forced Response on each moment (used: deal damage equal to the cards the Pull discarded; resolved:
 * place 1 threat on the main scheme).
 */
const PULL = "49001a.magnetic-pull";
const SURVIVOR = "49001b.survivor";
const USED_ANSWER = "99002.used-answer";
const RESOLVED_ANSWER = "99002.resolved-answer";
const LISTENER = "99002";

const MAGNETO = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const SEAT = {
  identityCardId: MAGNETO.identityCardId,
  aspects: MAGNETO.aspects,
  deck: MAGNETO.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};

const auntMay = CORE_CARDS.find((c) => c.id === cardId("01006"));
if (auntMay?.type !== "support") throw new Error("no Aunt May");
const LISTENER_CARD: AnyCard = {
  ...auntMay,
  id: cardId(LISTENER),
  name: "Pull Listener",
  cost: 0,
  unique: false,
  aspect: "basic",
  abilities: [{ id: abilityId(USED_ANSWER) }, { id: abilityId(RESOLVED_ANSWER) }],
} as AnyCard;
const FIXTURE = defineAbilities({
  [USED_ANSWER]: forcedResponse(
    on.moment(MAGNETIC_PULL_USED_MOMENT),
    dealDamage(varOf("moment.pulled.count"), yourIdentity),
  ),
  [RESOLVED_ANSWER]: forcedResponse(on.moment(MAGNETIC_PULL_MOMENT), placeThreat(1, theMainScheme)),
});
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_IDENTITY, FIXTURE) };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState): string[] => codes(s, playerOf(s, P1).hand);
const deckOf = (s: GameState): string[] => codes(s, playerOf(s, P1).deck);
/** Newest first, as the engine keeps it. */
const discardOf = (s: GameState): string[] => codes(s, playerOf(s, P1).discard);
const count = (list: readonly string[], code: string): number => list.filter((c) => c === code).length;
const moments = (events: readonly GameEvent[], name?: string) =>
  events.filter((e) => e.type === "momentRaised" && (name === undefined || e.name === name));
const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
const pull = (s: GameState) => use(P1, identityOf(s), PULL);

function setupGame(opts: { listener?: boolean } = {}): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...WAVE8_CARDS, LISTENER_CARD],
  } as never);
  const created = createGame(
    {
      ...config,
      players: [
        {
          identityCardId: SEAT.identityCardId,
          aspects: SEAT.aspects,
          deck: opts.listener ? [...SEAT.deck.slice(0, -1), cardId(LISTENER)] : SEAT.deck,
        },
      ],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const withForm = (s: GameState, form: "hero" | "alterEgo"): GameState => ({
  ...s,
  players: s.players.map((p) => ({
    ...p,
    identity: { ...p.identity, form, ...(form === "hero" ? { heroFormIndex: 0 } : {}) },
  })),
});
const heroGame = (opts?: { listener?: boolean }): GameState => withForm(setupGame(opts), "hero");

/**
 * Surgery: takes a copy of each code from the deck, the discard pile or (last) the hand; a card taken from the hand is
 * replaced by one from the bottom of the rest, so the hand keeps its size. Returns the ids and the rest of the cards.
 */
function take(state: GameState, wanted: readonly string[]) {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    used,
    rest: rest.slice(0, rest.length - takenFromHand),
    hand: [...strip(owner.hand), ...refill],
  };
}
const patchPlayer = (state: GameState, change: Partial<ReturnType<typeof playerOf>>): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === P1 ? { ...p, ...change } : p)),
});
/** Surgery: exactly this deck, top first; the discard pile is emptied and the rest is out of the way (in a spare list). */
function setDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const { used, hand } = take(state, wanted);
  return patchPlayer(state, { deck: used, discard: [], hand });
}
/** Surgery: the top of the deck, in order, above the rest; the discard pile is emptied into the deck's bottom. */
function stackDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const { used, rest, hand } = take(state, wanted);
  return patchPlayer(state, { deck: [...used, ...rest], discard: [], hand });
}
function withListener(state: GameState): GameState {
  const { state: s, ids } = moveToHand(state, P1, LISTENER);
  const played = settle(
    runWith(DEPS, s, { ...use(P1, ids[0]!, "x"), type: "playCard" } as never),
    firstLegal,
    undefined,
    DEPS,
  );
  return played;
}
void withListener;

const SQUARED_OFF = "49017"; // physical
const NOBLE = "49018"; // mental
const SHARDS = "49009"; // MAGNETIC, physical
const BUBBLE = "49006"; // MAGNETIC, energy
const ASTEROID = "49002"; // MAGNETIC, wild

describe("Magneto identity registry", () => {
  it.each([PULL, SURVIVOR])("%s validates", (id) => {
    expect(validateDefinition(MAGNETO_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the two identity refs", () => {
    expect(Object.keys(MAGNETO_IDENTITY).sort()).toEqual([PULL, SURVIVOR].sort());
  });
  it("Pull is an action with a limit of once per round; Survivor an optional response", () => {
    expect(MAGNETO_IDENTITY[PULL]!.trigger).toEqual({ kind: "action" });
    expect(MAGNETO_IDENTITY[PULL]!.limit).toEqual({ count: 1, period: "round" });
    expect(MAGNETO_IDENTITY[SURVIVOR]!.trigger.kind).toBe("response");
  });
  it("exports the two moment names", () => {
    expect([MAGNETIC_PULL_USED_MOMENT, MAGNETIC_PULL_MOMENT]).toEqual(["magneticPullUsed", "magneticPull"]);
  });
});

describe("Magnetic Pull", () => {
  it("test 1: Squared Off, Noble Sacrifice, Metal Shards: three discarded, Shards to hand, the other two in the discard pile", () => {
    const s0 = stackDeck(heroGame(), SQUARED_OFF, NOBLE, SHARDS);
    const handBefore = handOf(s0).length;
    const { state, events } = driveEvents(DEPS, s0, pull(s0));
    expect(discardOf(state).sort()).toEqual([SQUARED_OFF, NOBLE].sort());
    expect(handOf(state)).toHaveLength(handBefore + 1);
    expect(count(handOf(state), SHARDS)).toBeGreaterThan(count(handOf(s0), SHARDS));
    expect(deckOf(state)).toHaveLength(deckOf(s0).length - 3);
    expect(moments(events, MAGNETIC_PULL_USED_MOMENT)).toHaveLength(1);
    expect(moments(events, MAGNETIC_PULL_MOMENT)).toHaveLength(1);
  });

  it("test 1: a second Pull in the same round is refused, also after a flip and back; offered next round", () => {
    const s0 = stackDeck(heroGame(), SQUARED_OFF, NOBLE, SHARDS);
    const { state } = driveEvents(DEPS, s0, pull(s0));
    expect(applyCommand(state, pull(state), DEPS).ok).toBe(false);
    const flipped = withForm(withForm(state, "alterEgo"), "hero");
    expect(applyCommand(flipped, pull(flipped), DEPS).ok).toBe(false);
    const next = settle(
      runWith(DEPS, withForm(state, "hero"), endTurn(P1)),
      firstLegal,
      (s) => s.step.phase === "player" && s.round > state.round,
      DEPS,
    );
    const heroNext = withForm(next, "hero");
    expect(applyCommand(heroNext, pull(heroNext), DEPS).ok).toBe(true);
  });

  it("is not offered in alter-ego form", () => {
    const s = withForm(setupGame(), "alterEgo");
    expect(applyCommand(s, pull(s), DEPS).ok).toBe(false);
  });

  it("test 3: Asteroid M alone on top: it is found and carried (wild counts as no icon type), both moments raised", () => {
    const s0 = heroGame({ listener: true });
    const s1 = stackDeck(s0, ASTEROID);
    const { state, events } = driveEvents(DEPS, s1, pull(s1));
    expect(count(handOf(state), ASTEROID)).toBe(1);
    expect(discardOf(state)).toEqual([]);
    const [used] = moments(events, MAGNETIC_PULL_USED_MOMENT);
    expect(JSON.stringify(used)).toContain("pulled");
  });

  it("the found card is carried: both answers of the fixture fire for a Pull that found Metal Shards (Q42 = A: 3 cards, 3 damage)", () => {
    const s0 = heroGame({ listener: true });
    const { state: inHand, ids } = moveToHand(s0, P1, LISTENER);
    const played = settle(
      runWith(DEPS, inHand, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: ids[0]!,
        payment: [],
        attachToInstanceId: null,
      } as never),
      firstLegal,
      undefined,
      DEPS,
    );
    expect(playerOf(played, P1).playArea).toContain(ids[0]);
    const s1 = stackDeck(played, SQUARED_OFF, NOBLE, SHARDS);
    const threat = mainThreat(s1);
    const { state } = driveEvents(DEPS, s1, pull(s1));
    expect(damageOf(state)).toBe(damageOf(s1) + 3);
    expect(mainThreat(state)).toBe(threat + 1);
  });

  it("test 7 (Q41 = A): four cards, none MAGNETIC: four discarded, the deck resets, nothing to hand, only the used moment, the use is spent", () => {
    const s0 = heroGame({ listener: true });
    const { state: inHand, ids } = moveToHand(s0, P1, LISTENER);
    const played = settle(
      runWith(DEPS, inHand, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: ids[0]!,
        payment: [],
        attachToInstanceId: null,
      } as never),
      firstLegal,
      undefined,
      DEPS,
    );
    const s1 = setDeck(played, SQUARED_OFF, NOBLE, "49019", "49016");
    const hand = handOf(s1);
    const threat = mainThreat(s1);
    const { state, events } = driveEvents(DEPS, s1, pull(s1));
    expect(handOf(state)).toEqual(hand);
    expect(moments(events, MAGNETIC_PULL_USED_MOMENT)).toHaveLength(1);
    expect(moments(events, MAGNETIC_PULL_MOMENT)).toHaveLength(0);
    expect(damageOf(state)).toBe(damageOf(s1) + 4);
    expect(mainThreat(state)).toBe(threat);
    // The deck reset: the four discarded cards are back in a new deck, and a card was dealt from the encounter deck.
    expect(deckOf(state)).toHaveLength(4);
    expect(applyCommand(state, pull(state), DEPS).ok).toBe(false);
  });

  it("test 8: the MAGNETIC card is the last card of the deck: the deck resets and the card is taken into hand from the new deck", () => {
    const s0 = heroGame();
    const s1 = setDeck(s0, SQUARED_OFF, NOBLE, SHARDS);
    const hand = handOf(s1);
    const { state } = driveEvents(DEPS, s1, pull(s1));
    expect(count(handOf(state), SHARDS)).toBe(count(hand, SHARDS) + 1);
    expect(deckOf(state).sort()).toEqual([SQUARED_OFF, NOBLE].sort());
    expect(discardOf(state)).toEqual([]);
  });

  it("the match counts for a Magnetic Bubble on top too (Q42 = A): found card, no earlier discards, hand grows by one", () => {
    const s0 = stackDeck(heroGame(), BUBBLE);
    const { state } = driveEvents(DEPS, s0, pull(s0));
    expect(count(handOf(state), BUBBLE)).toBe(count(handOf(s0), BUBBLE) + 1);
  });
});

describe("Survivor (Erik Lehnsherr)", () => {
  /** These cards as the discard pile, first = top (newest). */
  const withDiscard = (s: GameState, ...wanted: readonly string[]): GameState => {
    const { used, rest, hand } = take(s, wanted);
    return patchPlayer(s, { deck: rest, discard: used, hand });
  };
  const toAlterEgo = (s: GameState): { state: GameState; events: readonly GameEvent[] } =>
    driveEvents(DEPS, s, { type: "changeForm", playerId: P1 } as never);
  const accept = (s: GameState) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "chooseTriggers") {
      const own = c.options.find((o) => o.optionId.endsWith(SURVIVOR));
      return own ? [own.optionId] : [];
    }
    return firstLegal(s);
  };

  it("changing to alter-ego form shuffles the top 3 of the discard pile into the deck; the rest stays", () => {
    const s0 = withDiscard(heroGame(), SQUARED_OFF, NOBLE, SHARDS, BUBBLE, ASTEROID);
    const top3 = discardOf(s0).slice(0, 3);
    const rest = discardOf(s0).slice(3);
    const deckBefore = deckOf(s0).length;
    const result = driveEventsPicking(s0, accept);
    expect(deckOf(result)).toHaveLength(deckBefore + 3);
    expect(discardOf(result)).toEqual(rest);
    for (const c of top3) expect(deckOf(result)).toContain(c);
  });

  it("fewer than 3 cards: all of them are shuffled in", () => {
    const s0 = withDiscard(heroGame(), SQUARED_OFF, NOBLE);
    const deckBefore = deckOf(s0).length;
    const result = driveEventsPicking(s0, accept);
    expect(deckOf(result)).toHaveLength(deckBefore + 2);
    expect(discardOf(result)).toEqual([]);
  });

  it("an empty discard pile: nothing happens", () => {
    const s0 = heroGame();
    const deckBefore = deckOf(s0).length;
    const result = driveEventsPicking(s0, accept);
    expect(deckOf(result)).toHaveLength(deckBefore);
  });

  it("declined: nothing moves", () => {
    const s0 = withDiscard(heroGame(), SQUARED_OFF, NOBLE, SHARDS);
    const result = driveEventsPicking(s0, firstLegal);
    expect(discardOf(result)).toHaveLength(3);
  });

  function driveEventsPicking(s: GameState, pick: (s: GameState) => readonly string[]): GameState {
    let cur = applyCommand(s, { type: "changeForm", playerId: P1 as PlayerId }, DEPS);
    if (!cur.ok) throw new Error(cur.error.message);
    let state = cur.state;
    while (state.pendingChoice) {
      const c = state.pendingChoice;
      const r = applyCommand(
        state,
        { type: "resolveChoice", playerId: c.playerId, choiceId: c.choiceId, selectedOptionIds: pick(state) },
        DEPS,
      );
      if (!r.ok) throw new Error(r.error.message);
      state = r.state;
    }
    void toAlterEgo;
    return state;
  }
});
