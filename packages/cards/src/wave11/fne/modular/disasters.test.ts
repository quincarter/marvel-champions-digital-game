import { PLAYABLE_CARDS, cardId, trait } from "@mc/content";
import {
  activeEncounterDeck,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_MODULAR_DISASTERS as REGISTRY, FNE_MODULAR_DISASTERS_SKIPPED as SKIPPED } from "./disasters.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Disasters modular set (60177 Mystic Incursion, 60178 Sinking Ferry, 60179 Towering Inferno, 60180 Collapsing
 * Bridge, 60181 Bystanders in Peril), docs/phase7-wave11-scenarios.md section S6. Each game is Core's Spider-Man
 * (Justice) against Rhino with the Disasters added to the Core encounter deck; Advance (01186) and Assault (01187) print
 * no boost icon and no boost ability, so they are the blank fillers. With `players: 2` Captain Marvel joins.
 */
const INCURSION = "60177";
const FERRY = "60178";
const INFERNO = "60179";
const BRIDGE = "60180";
const BYSTANDERS = "60181";
const ADVANCE = "01186";
const ASSAULT = "01187";
const DISASTERS = [INCURSION, FERRY, INFERNO];
const SCRIPTED = [
  "60177.mystic-incursion-action",
  "60178.sinking-ferry-action",
  "60179.towering-inferno-action",
  "60180.collapsing-bridge-forced-response",
  "60181.when-revealed",
  "60181.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const inDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const inDeck = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const civilians = (s: GameState, id: InstanceId): number => inst(s, id).counters["civilian"] ?? 0;
/** The Disaster environments in the villain area. */
const envsIn = (s: GameState): string[] => s.villainArea.map((i) => codeOf(s, i)).filter((c) => DISASTERS.includes(c));

/** Core's Spider-Man (hero form), plus Captain Marvel with `players: 2`, against Rhino with the Disasters shuffled in. */
function newGame(players = 1): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["disasters"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return withForm(settled, { heroForm: 0 });
}

/** A Disasters card put straight into the villain area (no reveal), holding `counters` civilian counters and `threat`. */
function staged(state: GameState, code: string, counters = 0, threat = 0) {
  const placed = encounterCardInVillainArea(state, code, threat);
  return { id: placed.id, state: patchInstance(placed.state, placed.id, { counters: { civilian: counters } }) };
}

/** The encounter deck and discard with every Disaster environment taken out of them. */
function withoutDisasters(state: GameState): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const piles = state.encounterDecks[deckId]!;
  const keep = (i: InstanceId) => !DISASTERS.includes(codeOf(state, i));
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: piles.deck.filter(keep), discard: piles.discard.filter(keep) },
    },
  };
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** P1 ends the turn in alter-ego form (Rhino schemes): `boosts` blank boost cards on top, then `dealt` to P1. */
function villainPhase(state: GameState, boosts: readonly string[], dealt: readonly string[], pick: Picker = declines) {
  return driveEventsPicking(
    WAVE11_DEPS,
    stackEncounterDeck(withForm(state, "alterEgo"), ...boosts, ...dealt),
    pick,
    endTurn(P1),
  );
}
/** A picker taking the pending choice's option for `target` when it is offered, else the first legal one. */
const choosing =
  (target: InstanceId): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find((o) => String(o.optionId) === String(target));
    return hit ? [hit.optionId as string] : declines(s);
  };

describe("registry", () => {
  it("registers every printed ref of the five cards; nothing is skipped", () => {
    const printed = [INCURSION, FERRY, INFERNO, BRIDGE, BYSTANDERS].flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...SCRIPTED].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...SCRIPTED].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(SCRIPTED)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    expect(REGISTRY["60177.mystic-incursion-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY["60180.collapsing-bridge-forced-response"]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["60181.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["60181.boost"]!.trigger).toMatchObject({ kind: "boost" });
  });
  it("the data prints Uses (2 civilian counters) on each environment and Hinder 2 per hero on the bridge", () => {
    for (const code of DISASTERS)
      expect(data(code).keywords).toContainEqual({ name: "uses", count: 2, counterType: "civilian" });
    expect(data(BRIDGE).keywords).toContainEqual({ name: "hinder", value: 0, perPlayer: 2 });
  });
});

describe("Collapsing Bridge 60180", () => {
  const thwart = (s: GameState, id: InstanceId, by: PlayerId = P1) =>
    driveEventsPicking(WAVE11_DEPS, s, declines, {
      type: "basicThwart",
      playerId: by,
      thwarterInstanceId: hero(s, by),
      schemeInstanceId: id,
    } as never);
  const removedBy = (events: readonly GameEvent[], id: InstanceId): number =>
    ofType(events, "threatRemoved")
      .filter((e) => e.schemeInstanceId === id)
      .reduce((n, e) => n + e.amount, 0);

  it("60180.collapsing-bridge-forced-response: after a thwart removes threat, 1 threat is placed back", () => {
    const b = staged(newGame(), BRIDGE, 0, 4);
    const run = thwart(b.state, b.id);
    const removed = removedBy(run.events, b.id);
    expect(removed).toBeGreaterThan(0);
    expect(inst(run.state, b.id).threat).toBe(4 - removed + 1);
    expect(ofType(run.events, "threatPlaced").filter((e) => e.schemeInstanceId === b.id)).toHaveLength(1);
  });

  it("60180.collapsing-bridge-forced-response: removing its last threat defeats it, and nothing stays on the card that left play", () => {
    const b = staged(newGame(), BRIDGE, 0, 1);
    const run = thwart(b.state, b.id);
    expect(removedBy(run.events, b.id)).toBe(1);
    expect(inDiscard(run.state)).toContain(BRIDGE);
    expect(run.state.villainArea).not.toContain(b.id);
    expect(inst(run.state, b.id).threat).toBe(0);
  });

  it("60180.collapsing-bridge-forced-response: threat removed from another side scheme does not trigger it", () => {
    const b = staged(newGame(), BRIDGE, 0, 3);
    const deckId = Object.keys(b.state.encounterDecks)[0]!;
    const pile = b.state.encounterDecks[deckId]!;
    const otherCode = [...pile.deck, ...pile.discard]
      .map((i) => codeOf(b.state, i))
      .find((c) => c !== BRIDGE && (PLAYABLE_CARDS as readonly any[]).find((p) => p.id === c)?.type === "side_scheme");
    expect(otherCode).toBeDefined();
    const other = staged(b.state, otherCode!, 0, 3);
    const run = thwart(other.state, other.id);
    expect(removedBy(run.events, other.id)).toBeGreaterThan(0);
    expect(inst(run.state, b.id).threat).toBe(3);
  });

  it("60180.collapsing-bridge-forced-response: two players, the other player's thwart triggers it too", () => {
    const b = staged(newGame(2), BRIDGE, 0, 4);
    // P1 ends the turn, then P2 (in hero form) thwarts.
    const turn = driveEventsPicking(WAVE11_DEPS, withForm(b.state, { heroForm: 0 }, P2), declines, endTurn(P1));
    const run = thwart(turn.state, b.id, P2);
    const removed = removedBy(run.events, b.id);
    expect(removed).toBeGreaterThan(0);
    expect(inst(run.state, b.id).threat).toBe(4 - removed + 1);
  });
});

describe("Bystanders in Peril 60181", () => {
  it("is Peril data", () => {
    expect(data(BYSTANDERS).keywords).toContainEqual({ name: "peril" });
  });

  it("60181.when-revealed: places 1 civilian counter on a Disaster environment in play", () => {
    const env = staged(newGame(), FERRY, 1);
    const run = villainPhase(env.state, [ADVANCE], [BYSTANDERS]);
    expect(inDiscard(run.state)).toContain(BYSTANDERS);
    expect(civilians(run.state, env.id)).toBe(2);
    // The environment in play took the counter: no search, so no other environment came into play.
    expect(envsIn(run.state)).toEqual([FERRY]);
  });

  it("60181.when-revealed: with two Disasters in play the revealing player picks which gets the counter", () => {
    const a = staged(newGame(), FERRY, 0);
    const b = staged(a.state, INFERNO, 0);
    const second = villainPhase(b.state, [ADVANCE], [BYSTANDERS], choosing(b.id));
    expect([civilians(second.state, a.id), civilians(second.state, b.id)]).toEqual([0, 1]);
    const first = villainPhase(b.state, [ADVANCE], [BYSTANDERS], choosing(a.id));
    expect([civilians(first.state, a.id), civilians(first.state, b.id)]).toEqual([1, 0]);
  });

  it("60181.when-revealed: with no Disaster in play, searches the encounter deck for one and reveals it", () => {
    const s = newGame();
    expect(envsIn(s)).toEqual([]);
    const run = villainPhase(s, [ADVANCE], [BYSTANDERS]);
    expect(envsIn(run.state)).toHaveLength(1);
    expect(inDiscard(run.state)).toContain(BYSTANDERS);
    // Only the one found came into play; the other two Disasters are still in the deck.
    for (const c of DISASTERS.filter((d) => !envsIn(run.state).includes(d))) expect(inDeck(run.state)).toContain(c);
    // It was revealed (its Uses put its 2 counters on it as it entered play), not given a third by this card.
    const found = run.state.villainArea.find((i) => DISASTERS.includes(codeOf(run.state, i)))!;
    expect(civilians(run.state, found)).toBe(2);
  });

  it("60181.when-revealed: the player chooses which Disaster to reveal, not the first in the deck", () => {
    const s = newGame();
    const deck = activeEncounterDeck(s).deck;
    const ids = DISASTERS.map((c) => deck.find((i) => codeOf(s, i) === c)!);
    const last = ids.at(-1)!;
    const pickLast: Picker = (st) =>
      st.pendingChoice?.options.some((o) => String(o.optionId) === String(last)) ? [last as string] : declines(st);
    const run = villainPhase(s, [ADVANCE], [BYSTANDERS], pickLast);
    expect(envsIn(run.state)).toEqual([codeOf(s, last)]);
    const first = villainPhase(s, [ADVANCE], [BYSTANDERS], (st) =>
      st.pendingChoice?.options.some((o) => String(o.optionId) === String(ids[0])) ? [ids[0] as string] : declines(st),
    );
    expect(envsIn(first.state)).toEqual([codeOf(s, ids[0]!)]);
  });

  it("60181.when-revealed: the search also reaches the encounter discard pile", () => {
    const s = newGame();
    const deckId = Object.keys(s.encounterDecks)[0]!;
    const piles = s.encounterDecks[deckId]!;
    const envIds = piles.deck.filter((i) => DISASTERS.includes(codeOf(s, i)));
    expect(envIds).toHaveLength(3);
    const moved: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => !envIds.includes(i)), discard: [...piles.discard, ...envIds] },
      },
    };
    expect(inDeck(moved).filter((c) => DISASTERS.includes(c))).toEqual([]);
    const run = villainPhase(moved, [ADVANCE], [BYSTANDERS]);
    expect(envsIn(run.state)).toHaveLength(1);
  });

  it("60181.when-revealed: with no Disaster anywhere, nothing is revealed", () => {
    const run = villainPhase(withoutDisasters(newGame()), [ADVANCE], [BYSTANDERS]);
    expect(envsIn(run.state)).toEqual([]);
    expect(inDiscard(run.state)).toContain(BYSTANDERS);
  });

  it("60181.when-revealed: two players, P2 is dealt it: P2 (the revealer) picks the environment and P1 is not asked", () => {
    const a = staged(newGame(2), FERRY, 0);
    const b = staged(a.state, INFERNO, 0);
    const asked: PlayerId[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.options.some((o) => String(o.optionId) === String(b.id))) {
        asked.push(choice.playerId);
        return [b.id as string];
      }
      return declines(s);
    };
    const order = b.state.firstPlayerId === P2 ? [endTurn(P2), endTurn(P1)] : [endTurn(P1), endTurn(P2)];
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(
        withForm(withForm(b.state, "alterEgo", P1), "alterEgo", P2),
        ADVANCE,
        ASSAULT,
        ADVANCE,
        BYSTANDERS,
      ),
      pick,
      ...order,
    );
    expect(asked).toEqual([P2]);
    expect([civilians(run.state, a.id), civilians(run.state, b.id)]).toEqual([0, 1]);
  });

  it("60181.boost: boosting an attack places 1 civilian counter on a Disaster environment", () => {
    const env = staged(newGame(), INCURSION, 1);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(env.state, BYSTANDERS, ADVANCE),
      declines,
      endTurn(P1),
    );
    expect(ofType(run.events, "boostCardFlipped").length).toBeGreaterThan(0);
    expect(civilians(run.state, env.id)).toBe(2);
  });

  it("60181.boost: with no Disaster in play it does nothing (no search, unlike the When Revealed)", () => {
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(newGame(), BYSTANDERS, ADVANCE),
      declines,
      endTurn(P1),
    );
    expect(ofType(run.events, "boostCardFlipped").length).toBeGreaterThan(0);
    expect(envsIn(run.state)).toEqual([]);
  });
});

/** A printed ally with the given trait (any pack), as a ready ally in P1's play area: a hand card is turned into it. */
function allyWith(state: GameState, code: string) {
  const id = playerOf(state, P1).hand[0]!;
  const next: GameState = {
    ...state,
    players: state.players.map((q) =>
      q.playerId === P1 ? { ...q, hand: q.hand.filter((i) => i !== id), playArea: [...q.playArea, id] } : q,
    ),
  };
  return {
    id,
    state: patchInstance(next, id, {
      cardId: cardId(code),
      faceup: true,
      exhausted: false,
      controllerId: P1,
      home: { kind: "playArea", playerId: P1 },
    } as never),
  };
}
const allyCodeWith = (name: string): string =>
  (PLAYABLE_CARDS as readonly any[]).find((c) => c.type === "ally" && (c.traits ?? []).includes(trait(name)))!
    .id as string;
const PLAIN = "01002"; // Black Cat: neither Mystic nor Aerial
const printed = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any).resourceIcons ?? {};
/** Hand codes of cards whose only printed resource is one icon of `type`. */
const onlyOf = (state: GameState, type: string): string[] =>
  [...playerOf(state, P1).hand, ...playerOf(state, P1).deck]
    .map((i) => codeOf(state, i))
    .filter((c) => (printed(c)[type] ?? 0) === 1 && Object.entries(printed(c)).every(([k, n]) => k === type || !n));

describe("the environments' Hero Actions", () => {
  const CASES = [
    { code: INCURSION, ref: "60177.mystic-incursion-action", type: "mental", bonus: () => allyCodeWith("MYSTIC") },
    { code: FERRY, ref: "60178.sinking-ferry-action", type: "energy", bonus: () => allyCodeWith("AERIAL") },
    { code: INFERNO, ref: "60179.towering-inferno-action", type: "physical", bonus: () => PLAIN },
  ];
  const exhausted = (s: GameState, id: InstanceId) => inst(s, id).exhausted;
  for (const c of CASES) {
    const isTough = c.code === INFERNO;
    /** A game with the environment (2 counters) and an ally (tough status for Inferno's bonus case) in play. */
    const setup = (bonusAlly: boolean) => {
      const env = staged(newGame(), c.code, 2);
      const ally = allyWith(env.state, bonusAlly ? c.bonus() : PLAIN);
      const toughened =
        isTough && bonusAlly
          ? patchInstance(ally.state, ally.id, { statuses: { stunned: 0, confused: 0, tough: 1 } })
          : ally.state;
      return { env: env.id, ally: ally.id, state: toughened };
    };
    const exhaustAlly = (g: ReturnType<typeof setup>) =>
      driveEventsPicking(
        WAVE11_DEPS,
        g.state,
        declines,
        use(P1, g.env, c.ref, [], { exhausted: [g.ally] }, { branch: 1 }),
      );

    it(`${c.ref}: spending two ${c.type} resources removes 1 counter, even with a bonus character in play`, () => {
      const g = setup(true);
      const cards = onlyOf(g.state, c.type).slice(0, 2);
      expect(cards).toHaveLength(2);
      const given = moveToHand(g.state, P1, ...cards);
      const run = driveEventsPicking(
        WAVE11_DEPS,
        given.state,
        declines,
        use(
          P1,
          g.env,
          c.ref,
          given.ids.map((fromHand) => ({ fromHand })),
          undefined,
          { branch: 0 },
        ),
      );
      expect(civilians(run.state, g.env)).toBe(1);
      expect(exhausted(run.state, g.ally)).toBe(false);
    });

    it(`${c.ref}: exhausting a character with no bonus removes 1 counter`, () => {
      const g = setup(false);
      const run = exhaustAlly(g);
      expect(exhausted(run.state, g.ally)).toBe(true);
      expect(civilians(run.state, g.env)).toBe(1);
    });

    it(`${c.ref}: exhausting the bonus character removes 2 and the last counter discards the card`, () => {
      const g = setup(true);
      const run = exhaustAlly(g);
      expect(exhausted(run.state, g.ally)).toBe(true);
      expect(inDiscard(run.state)).toContain(c.code);
      expect(run.state.villainArea).not.toContain(g.env);
    });

    it(`${c.ref}: exhausting your hero is also a valid cost`, () => {
      const g = setup(false);
      const run = driveEventsPicking(
        WAVE11_DEPS,
        g.state,
        declines,
        use(P1, g.env, c.ref, [], { exhausted: [hero(g.state)] }, { branch: 1 }),
      );
      expect(exhausted(run.state, hero(g.state))).toBe(true);
      expect(civilians(run.state, g.env)).toBe(1);
    });

    it(`${c.ref}: only a hero or ally you control can be exhausted: the other player's ally is not offered`, () => {
      const base = staged(newGame(2), c.code, 2);
      const p2 = playerOf(base.state, P2).hand[0]!;
      const theirs = patchInstance(
        {
          ...base.state,
          players: base.state.players.map((q) =>
            q.playerId === P2 ? { ...q, hand: q.hand.filter((i) => i !== p2), playArea: [...q.playArea, p2] } : q,
          ),
        },
        p2,
        {
          cardId: cardId(PLAIN),
          faceup: true,
          exhausted: false,
          controllerId: P2,
          home: { kind: "playArea", playerId: P2 },
        } as never,
      );
      // P1 names the other player's ally: refused, since a cost is paid with cards you control.
      expect(() =>
        driveEventsPicking(
          WAVE11_DEPS,
          theirs,
          declines,
          use(P1, base.id, c.ref, [], { exhausted: [p2] }, { branch: 1 }),
        ),
      ).toThrow();
      const run = driveEventsPicking(
        WAVE11_DEPS,
        theirs,
        declines,
        use(P1, base.id, c.ref, [], undefined, { branch: 1 }),
      );
      expect(exhausted(run.state, p2)).toBe(false);
      expect(exhausted(run.state, hero(theirs))).toBe(true);
      expect(civilians(run.state, base.id)).toBe(1);
    });
  }
});
