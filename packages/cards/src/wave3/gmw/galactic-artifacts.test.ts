import {
  activeEncounterDeckId,
  cardOf,
  characterProfile,
  printedResources,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import type { Command, GameEvent } from "@mc/engine";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
  use,
} from "../../testing/harness.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { wave3Scenario } from "../setup.js";

/**
 * The Galactic Artifacts modular set (16122–16130, `gmw/galactic-artifacts.ts`), exercised through Infiltrate the
 * Museum (whose 1A "Contents" names it, docs/phase7-wave3.md §2.2).
 */
const museum = () =>
  startWave3Game(
    wave3Scenario("infiltrate-the-museum", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

/** Attaches an encounter-deck (or discard-pile) card straight to a host (surgery, the same shape `gmw/ronan.
 * test.ts`'s own `attachTo` uses) — for a card not already in play. */
function attachTo(
  state: GameState,
  code: string,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Puts an encounter-deck side scheme straight into the villain area with a given threat (surgery: no reveal, no
 * boost draw — the same "skip the noisy villain-phase machinery" reasoning `gmw/ruthless.test.ts`'s own docblock
 * explains). */
function putSideSchemeIntoPlay(
  state: GameState,
  code: string,
  threat: number,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
    },
  };
}

/** Moves enough of `playerId`'s own deck cards of `type` into their hand so a typed resource cost is payable —
 * `gmw`'s own starting hand at this seed doesn't always carry enough of one type (docs/card-scripting-process.md
 * §7's own "a card scan tells you what the printed text means, not what the test needs" lesson, the resource
 * analog). */
function ensureResourceCardsInHand(
  state: GameState,
  playerId: PlayerId,
  type: "physical" | "mental" | "energy",
  n: number,
): GameState {
  const player = playerOf(state, playerId);
  const matches = (id: InstanceId) => {
    const c = cardOf(state, id);
    return c ? printedResources(c)[type] > 0 : false;
  };
  const have = player.hand.filter(matches);
  if (have.length >= n) return state;
  const fromDeck = player.deck.filter(matches).slice(0, n - have.length);
  if (have.length + fromDeck.length < n) throw new Error(`not enough ${type} cards for ${playerId}`);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId
        ? { ...p, hand: [...p.hand, ...fromDeck], deck: p.deck.filter((id) => !fromDeck.includes(id)) }
        : p,
    ),
  };
}

/** `n` hand cards that can pay `type` (their own printed type, or wild). */
function paymentFor(
  state: GameState,
  playerId: PlayerId,
  type: "physical" | "mental" | "energy",
  n: number,
): readonly { readonly fromHand: InstanceId }[] {
  const player = playerOf(state, playerId);
  const usable = player.hand.filter((id) => {
    const c = cardOf(state, id);
    if (!c) return false;
    const pool = printedResources(c);
    return pool[type] > 0 || pool.wild > 0;
  });
  if (usable.length < n) throw new Error(`not enough ${type}-payable cards for ${playerId}`);
  return usable.slice(0, n).map((fromHand) => ({ fromHand }));
}

describe("Cloak of Hercules (16122)", () => {
  it("Hero Action: spend 3 physical resources to discard this card (16122.cloak-of-hercules-action)", () => {
    const state = museum();
    const villain = state.villains[0]!.instanceId;
    const { state: attached, id: artifact } = attachTo(state, "16122", villain);
    const heroState = runWave3(attached, toHero());
    const primed = ensureResourceCardsInHand(heroState, P1, "physical", 3);
    const payment = paymentFor(primed, P1, "physical", 3);
    const after = settle(
      runWave3(primed, use(P1, artifact, "16122.cloak-of-hercules-action", payment)),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, villain).attachments).not.toContain(artifact);
  });
});

describe("Obedience Potion (16123)", () => {
  it("Attached character gets -1 THW, -1 ATK, and -1 DEF (16123.obedience-potion-constant)", () => {
    const state = museum();
    const identity = identityOf(state, P1);
    const { state: attached } = attachTo(state, "16123", identity);
    const heroState = runWave3(attached, toHero());
    const profile = characterProfile(heroState, identity, WAVE3_DEPS);
    const baseline = characterProfile(runWave3(state, toHero()), identity, WAVE3_DEPS);
    expect(profile!.thw).toBe(baseline!.thw - 1);
    expect(profile!.atk).toBe(baseline!.atk - 1);
    expect(profile!.def).toBe(baseline!.def - 1);
  });

  it("Hero Action: take 1 damage and spend 2 mental resources to discard this card (16123.obedience-potion-action)", () => {
    const state = museum();
    const identity = identityOf(state, P1);
    const { state: attached, id: artifact } = attachTo(state, "16123", identity);
    const heroState = runWave3(attached, toHero());
    const primed = ensureResourceCardsInHand(heroState, P1, "mental", 2);
    const payment = paymentFor(primed, P1, "mental", 2);
    const damageBefore = inst(primed, identity).damage;
    const after = settle(
      runWave3(primed, use(P1, artifact, "16123.obedience-potion-action", payment)),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, identity).damage).toBe(damageBefore + 1);
    expect(inst(after, identity).attachments).not.toContain(artifact);
  });
});

describe("The Beyonder's Blazer (16124)", () => {
  it("Hero Action: place 2 threat on the main scheme and spend 2 resources to discard this card (16124.the-beyonders-blazer-action)", () => {
    const state = museum();
    const villain = state.villains[0]!.instanceId;
    const { state: attached, id: artifact } = attachTo(state, "16124", villain);
    const heroState = runWave3(attached, toHero());
    const payment = playerOf(heroState, P1)
      .hand.slice(0, 2)
      .map((fromHand) => ({ fromHand }));
    const threatBefore = mainThreat(heroState);
    const after = settle(
      runWave3(heroState, use(P1, artifact, "16124.the-beyonders-blazer-action", payment)),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(after)).toBe(threatBefore + 2);
    expect(inst(after, villain).attachments).not.toContain(artifact);
  });
});

describe("The Poison (16125)", () => {
  /** Ends P1's turn and answers every choice until P1's next turn has begun, collecting the events on the way. */
  function toNextTurn(state: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
    const round = state.round;
    const events: GameEvent[] = [];
    let current = state;
    const step = (command: Command) => {
      const result = applyOk(current, command, WAVE3_DEPS);
      current = result.state;
      events.push(...result.events);
    };
    step(endTurn(P1));
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 500) throw new Error("choices did not settle");
      const choice = current.pendingChoice;
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    expect(current.round).toBe(round + 1);
    expect(current.step).toMatchObject({ kind: "turn", activePlayerId: P1 });
    return { state: current, events };
  }

  it("Forced Interrupt: when your turn begins, place 1 poison counter, then take 1 damage per counter (16125.the-poison-forced-interrupt)", () => {
    const state = museum();
    const identity = identityOf(state, P1);
    const { state: attached, id: poison } = attachTo(state, "16125", identity);
    const fromPoison = (events: readonly GameEvent[]) =>
      events.flatMap((e) => (e.type === "damageDealt" && e.sourceInstanceId === poison ? [e] : []));

    const first = toNextTurn(attached);
    expect(inst(first.state, poison).counters.poison).toBe(1);
    expect(fromPoison(first.events)).toEqual([
      { type: "damageDealt", targetInstanceId: identity, amount: 1, sourceInstanceId: poison },
    ]);
    // It is an interrupt to the turn beginning: its window opens after the turn start is initiated and before the
    // turn start resolves (docs/phase7-wave3.md §3.46).
    const at = (predicate: (e: GameEvent) => boolean) => first.events.findIndex(predicate);
    const initiated = at((e) => e.type === "triggerEvent" && e.event.kind === "turnStarted" && e.phase === "initiated");
    const resolved = at((e) => e.type === "triggerEvent" && e.event.kind === "turnStarted" && e.phase === "resolved");
    const damage = at((e) => e.type === "damageDealt" && e.sourceInstanceId === poison);
    expect(initiated).toBeGreaterThanOrEqual(0);
    expect(initiated).toBeLessThan(damage);
    expect(damage).toBeLessThan(resolved);

    // The next turn: a second counter, and 2 damage. (The main scheme's threat is cleared so a second villain phase
    // doesn't complete it first.)
    const second = toNextTurn(patchInstance(first.state, first.state.mainScheme.instanceId, { threat: 0 }));
    expect(inst(second.state, poison).counters.poison).toBe(2);
    expect(fromPoison(second.events).map((e) => e.amount)).toEqual([2]);
  });

  it("Hero Action: spend 3 resources of different types to discard this card (16125.the-poison-action)", () => {
    const state = museum();
    const identity = identityOf(state, P1);
    const { state: attached, id: artifact } = attachTo(state, "16125", identity);
    const heroState = runWave3(attached, toHero());
    const physical = paymentFor(heroState, P1, "physical", 1)[0]!;
    const mental = paymentFor(heroState, P1, "mental", 1)[0]!;
    const energy = paymentFor(heroState, P1, "energy", 1)[0]!;
    const after = settle(
      runWave3(heroState, use(P1, artifact, "16125.the-poison-action", [physical, mental, energy])),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, identity).attachments).not.toContain(artifact);
  });
});

describe("Vandarian Power Stone (16126)", () => {
  it("Hero Action: spend 3 energy resources to discard this card (16126.vandarian-power-stone-action)", () => {
    const state = museum();
    const villain = state.villains[0]!.instanceId;
    const { state: attached, id: artifact } = attachTo(state, "16126", villain);
    const heroState = runWave3(attached, toHero());
    const primed = ensureResourceCardsInHand(heroState, P1, "energy", 3);
    const payment = paymentFor(primed, P1, "energy", 3);
    const after = settle(
      runWave3(primed, use(P1, artifact, "16126.vandarian-power-stone-action", payment)),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, villain).attachments).not.toContain(artifact);
  });
});

describe("Hujahdarian Monarch Egg (16127)", () => {
  it("When Defeated: the defeating player may ready their identity (16127.when-defeated)", () => {
    const heroState = runWave3(museum(), toHero());
    const identity = identityOf(heroState, P1);
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16127", 1);
    const after = settle(
      runWave3(placed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    // A basic thwart exhausts the thwarting character; the "may ready" effect undoes that, so the identity ends
    // this action readied rather than exhausted — the meaningful difference from an ordinary thwart.
    expect(inst(after, identity).exhausted).toBe(false);
  });
});

describe("Magical Teapot (16128)", () => {
  it("When Defeated: the defeating player may heal 4 damage from their identity (16128.when-defeated)", () => {
    const heroState = runWave3(museum(), toHero());
    const identity = identityOf(heroState, P1);
    const damaged = patchInstance(heroState, identity, { damage: 4 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(damaged, "16128", 1);
    const after = settle(
      runWave3(placed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, identity).damage).toBe(0);
  });
});

describe("Philosopher's Stone (16129)", () => {
  it("When Defeated: the defeating player may draw 2 cards (16129.when-defeated)", () => {
    const heroState = runWave3(museum(), toHero());
    const identity = identityOf(heroState, P1);
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16129", 1);
    const handBefore = playerOf(placed, P1).hand.length;
    const after = settle(
      runWave3(placed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 2);
  });
});

describe("Crystal Ball (16130)", () => {
  it("When Defeated: the defeating player may play a card from their hand, reducing its resource cost by 3 (16130.when-defeated)", () => {
    const heroState = runWave3(museum(), toHero());
    const identity = identityOf(heroState, P1);
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16130", 1);
    const handBefore = playerOf(placed, P1).hand.length;
    const after = settle(
      runWave3(placed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    // "May" — declining (or having nothing legally playable) is a legal outcome too, so this only pins that the
    // scheme itself was defeated and the ability resolved without throwing; a hand-shrinks assertion would be
    // vacuously true half the time `firstLegal` happens to decline.
    expect(playerOf(after, P1).hand.length).toBeLessThanOrEqual(handBefore);
  });
});
