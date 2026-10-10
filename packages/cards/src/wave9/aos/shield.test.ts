import { cardId } from "@mc/content";
import { cardsInPlay, playCostOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, identityOf, inst, instancesOf, firstLegal, patchInstance, playerOf, use } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  FILLER_A,
  codeOf,
  dataOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  piles,
  setKit,
  stunWith,
  types,
} from "../testing.js";
import { SHIELD, SHIELD_SKIPPED } from "./shield.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The S.H.I.E.L.D. set (50178 S.H.I.E.L.D. Trooper, 50179 Arrest Warrant, 50180 Disavowed), docs/phase7-wave9.md sections
 * 3.1 and 3.35. Rhino (Core, standard) against a Spider-Man starter deck with the set's copies added to the encounter
 * deck. Cards of other kinds are made by relabeling a deck or hand instance (surgery), so only the set's own
 * abilities are live. Every ref is scripted.
 */
const TROOPER = "50178";
const WARRANT = "50179";
const DISAVOWED = "50180";
const REGISTERED = ["50178.when-defeated", "50179.obligation", "50180.disavowed-constant", "50180.when-revealed"];
const MARIA_HILL_ALLY = "50036"; // S.H.I.E.L.D. ally, cost 3
const SUPPORT_STAFF = "50008"; // S.H.I.E.L.D. support, cost 1
const GLOBAL_LOGISTICS = "50049"; // S.H.I.E.L.D. event, cost 0
const AUNT_MAY = "01006"; // not S.H.I.E.L.D., cost 1

const { deps: DEPS, setupGame, villainPhase } = setKit("s.h.i.e.l.d.", SHIELD);
const mainThreat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
const relabel = (s: GameState, id: InstanceId, code: string) => patchInstance(s, id, { cardId: cardId(code) });

/** A card from the player's deck relabeled as `code` and put in their play area, under their control. */
function controlling(state: GameState, code: string, which = 0): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).deck[which]!;
  const relabeled = relabel(state, id, code);
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...relabeled.instances, [id]: { ...relabeled.instances[id]!, faceup: true } },
    },
  };
}

/** A hand card relabeled as `code`: its play cost as it stands. */
function handCost(state: GameState, code: string): number {
  const id = playerOf(state, P1).hand[0]!;
  return playCostOf(relabel(state, id, code), P1, id, DEPS)!.current;
}

describe("registry", () => {
  it("registers the four refs of the three cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(SHIELD).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(SHIELD)) expect(validateDefinition(def), id).toEqual([]);
    expect(SHIELD_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs", () => {
    const refs = [TROOPER, WARRANT, DISAVOWED].flatMap((code) =>
      ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id),
    );
    expect(refs.sort()).toEqual([...REGISTERED].sort());
  });

  it("setup: 3 Troopers, 1 Arrest Warrant and 1 Disavowed are in the encounter deck", () => {
    const s = setupGame();
    const counts = [TROOPER, WARRANT, DISAVOWED].map((c) => piles(s).deck.filter((id) => codeOf(s, id) === c).length);
    expect(counts).toEqual([3, 1, 1]);
  });
});

describe("S.H.I.E.L.D. Trooper (50178)", () => {
  it("is data: a S.H.I.E.L.D. minion, ATK 2, SCH 0, 4 hit points, 1 boost icon, Patrol and Vulnerable", () => {
    const card = dataOf(TROOPER);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons]).toEqual(["minion", 2, 0, 4, 1]);
    expect(card.traits).toEqual(["S.H.I.E.L.D."]);
    expect(card.keywords).toEqual([{ name: "patrol" }, { name: "vulnerable" }]);
  });

  it("is not defeated by being stunned: Vulnerable discards it, and its When Defeated does not resolve", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), TROOPER, P1);
    const before = mainThreat(engaged);
    const run = stunWith(DEPS, engaged, id);
    expect(inDiscard(run.state, TROOPER)).toEqual([id]);
    expect(types(run.events, "characterDefeated")).toEqual([]);
    expect(mainThreat(run.state)).toBe(before);
  });

  /** The Trooper (4 hit points, 3 damage) engaged with P1 is defeated by a real basic attack of Spider-Man (1 ATK). */
  function defeated(state: GameState) {
    const { state: engaged, id } = engageMinion(heroForm(state), TROOPER, P1);
    const staged = patchInstance(engaged, id, { damage: 3 });
    const before = mainThreat(staged);
    const run = driveEventsPicking(DEPS, staged, (s) => s.pendingChoice!.options.slice(0, 1).map((o) => o.optionId), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: id,
    });
    return { run, id, before };
  }

  it("When Defeated: with no S.H.I.E.L.D. ally or support under the engaged player, 2 threat go on the main scheme", () => {
    const { run, id, before } = defeated(setupGame());
    expect(types(run.events, "characterDefeated")).toHaveLength(1);
    expect(inDiscard(run.state, TROOPER)).toEqual([id]);
    expect(mainThreat(run.state)).toBe(before + 2);
  });

  it("When Defeated: a S.H.I.E.L.D. ally the engaged player controls is discarded instead, with no threat placed", () => {
    const { state, id: ally } = controlling(setupGame(), MARIA_HILL_ALLY);
    const { run, before } = defeated(state);
    expect(playerOf(run.state, P1).playArea).not.toContain(ally);
    expect(playerOf(run.state, P1).discard).toContain(ally);
    expect(mainThreat(run.state)).toBe(before);
  });

  it("When Defeated: a S.H.I.E.L.D. support is discarded the same way", () => {
    const { state, id: support } = controlling(setupGame(), SUPPORT_STAFF);
    const { run, before } = defeated(state);
    expect(playerOf(run.state, P1).discard).toContain(support);
    expect(mainThreat(run.state)).toBe(before);
  });

  it("When Defeated: with two candidates only the one the player chooses is discarded", () => {
    const first = controlling(setupGame(), MARIA_HILL_ALLY, 0);
    const second = controlling(first.state, SUPPORT_STAFF, 0);
    const { state, id: engagedId } = engageMinion(heroForm(second.state), TROOPER, P1);
    const staged = patchInstance(state, engagedId, { damage: 3 });
    const pickSecond = (s: GameState) => {
      const options = s.pendingChoice!.options;
      const match = options.find((o) => o.ref.kind === "card" && o.ref.instanceId === second.id);
      return [(match ?? options[0]!).optionId];
    };
    const run = driveEventsPicking(DEPS, staged, pickSecond, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: engagedId,
    });
    expect(playerOf(run.state, P1).discard).toContain(second.id);
    expect(playerOf(run.state, P1).playArea).toContain(first.id);
  });

  it("When Defeated: a card that is not S.H.I.E.L.D. (an ally of another trait) does not count: 2 threat", () => {
    const { state } = controlling(setupGame(), "01006");
    const { run, before } = defeated(state);
    expect(mainThreat(run.state)).toBe(before + 2);
  });
});

describe("Arrest Warrant (50179)", () => {
  it("is data: a S.H.I.E.L.D. obligation with 2 boost icons and 1 acceleration icon", () => {
    const card = dataOf(WARRANT);
    expect([card.type, card.boostIcons, card.schemeIcons, card.traits]).toEqual([
      "obligation",
      2,
      ["acceleration"],
      ["S.H.I.E.L.D."],
    ]);
  });

  /** The Warrant revealed to P1 in the villain phase; P1 is back in alter-ego form in the next player phase. */
  function revealed() {
    const run = villainPhase(setupGame(), [BLANK, WARRANT, FILLER_A]);
    return { state: run.state, id: instancesOf(run.state, WARRANT)[0]! };
  }
  const ACTION = "50179.obligation";
  const act = (state: GameState, id: InstanceId, paid: readonly InstanceId[], pick = firstLegal) =>
    driveEventsPicking(DEPS, state, pick, use(P1, id, ACTION, [], { exhausted: paid }));

  it("when revealed it stays in the revealing player's play area (it is given to P1), and counts as an acceleration icon", () => {
    const { state, id } = revealed();
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(cardsInPlay(state)).toContain(id);
    expect(piles(state).discard).not.toContain(id);
  });

  it("Alter-Ego Action, paying with the identity: the identity exhausts, a S.H.I.E.L.D. minion is revealed engaged with P1, the Warrant is discarded", () => {
    const { state, id } = revealed();
    const hero = identityOf(state);
    expect(inst(state, hero).exhausted).toBe(false);
    const run = act(state, id, [hero]);
    expect(inst(run.state, hero).exhausted).toBe(true);
    const trooper = inPlayCard(run.state, TROOPER)!;
    expect(inst(run.state, trooper).engagedWith).toBe(P1);
    expect(types(run.events, "encounterCardRevealed").map((e) => codeOf(run.state, e.instanceId))).toContain(TROOPER);
    expect(playerOf(run.state, P1).playArea).not.toContain(id);
    expect(piles(run.state).discard).toContain(id);
  });

  it("Alter-Ego Action, paying with a S.H.I.E.L.D. card: that card exhausts and the identity stays ready", () => {
    const { state: withAlly, id: ally } = controlling(revealed().state, MARIA_HILL_ALLY);
    const id = instancesOf(withAlly, WARRANT)[0]!;
    const run = act(withAlly, id, [ally]);
    expect(inst(run.state, ally).exhausted).toBe(true);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(inPlayCard(run.state, TROOPER)).toBeDefined();
    expect(piles(run.state).discard).toContain(id);
  });

  it("a card that is not S.H.I.E.L.D. cannot pay", () => {
    const { state: withAlly, id: ally } = controlling(revealed().state, AUNT_MAY);
    const id = instancesOf(withAlly, WARRANT)[0]!;
    expect(() => act(withAlly, id, [ally])).toThrow(/no_valid_target/);
  });

  it("the search takes a S.H.I.E.L.D. minion from the discard pile too", () => {
    const { state, id } = revealed();
    const trooperIds = instancesOf(state, TROOPER);
    const pile = piles(state);
    const moved: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [Object.keys(state.encounterDecks)[0]!]: {
          deck: pile.deck.filter((i) => !trooperIds.includes(i)),
          discard: [...pile.discard, trooperIds[0]!],
        },
      },
    };
    const run = act(moved, id, [identityOf(moved)]);
    expect(inPlayCard(run.state, TROOPER)).toBe(trooperIds[0]);
  });

  it("with no S.H.I.E.L.D. minion left to find, the cost is still paid and the Warrant is still discarded", () => {
    const { state, id } = revealed();
    const gone = instancesOf(state, TROOPER);
    const pile = piles(state);
    const emptied: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [Object.keys(state.encounterDecks)[0]!]: {
          deck: pile.deck.filter((i) => !gone.includes(i)),
          discard: pile.discard.filter((i) => !gone.includes(i)),
        },
      },
    };
    const run = act(emptied, id, [identityOf(emptied)]);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    expect(inPlayCard(run.state, TROOPER)).toBeUndefined();
    expect(piles(run.state).discard).toContain(id);
  });

  it("is an Alter-Ego Action: refused in hero form", () => {
    const { state, id } = revealed();
    expect(() => act(heroForm(state), id, [identityOf(state)])).toThrow(/wrong_form/);
  });
});

describe("Disavowed (50180)", () => {
  it("is data: a S.H.I.E.L.D. side scheme, 2 starting threat flat, a hazard icon, 3 boost icons", () => {
    const card = dataOf(DISAVOWED);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.traits]).toEqual([
      "side_scheme",
      { base: 2, perPlayer: 0 },
      ["hazard"],
      3,
      ["S.H.I.E.L.D."],
    ]);
  });

  it("When Revealed: 1 threat for each S.H.I.E.L.D. card in play, on top of the starting threat", () => {
    const { state } = controlling(setupGame(), MARIA_HILL_ALLY);
    const run = villainPhase(heroForm(state), [BLANK, DISAVOWED, FILLER_A]);
    const id = inPlayCard(run.state, DISAVOWED)!;
    // Maria Hill and Disavowed itself: 2 S.H.I.E.L.D. cards in play.
    expect(inst(run.state, id).threat).toBe(2 + 2);
  });

  it("the cost modifier: each S.H.I.E.L.D. ally, support and event costs 1 more, an unaffected card is unchanged", () => {
    const base = setupGame();
    expect([MARIA_HILL_ALLY, SUPPORT_STAFF, GLOBAL_LOGISTICS, AUNT_MAY].map((c) => handCost(base, c))).toEqual([
      3, 1, 0, 1,
    ]);
    const run = villainPhase(heroForm(base), [BLANK, DISAVOWED, FILLER_A]);
    expect(inPlayCard(run.state, DISAVOWED)).toBeDefined();
    expect([MARIA_HILL_ALLY, SUPPORT_STAFF, GLOBAL_LOGISTICS, AUNT_MAY].map((c) => handCost(run.state, c))).toEqual([
      4, 2, 1, 1,
    ]);
  });

  it("the modifier ends when the scheme is defeated", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, DISAVOWED, FILLER_A]);
    const id = inPlayCard(run.state, DISAVOWED)!;
    const thwarted = heroThwarts(DEPS, patchInstance(run.state, id, { threat: 1 }), id);
    expect(inPlayCard(thwarted.state, DISAVOWED)).toBeUndefined();
    expect(handCost(thwarted.state, MARIA_HILL_ALLY)).toBe(3);
  });
});
