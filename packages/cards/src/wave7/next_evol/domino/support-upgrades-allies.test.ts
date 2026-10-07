import {
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withDamage, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { DOMINO_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Domino's allies, supports and upgrades (40038 Diamondback, 40039 Outlaw, 40044 Pip the Pug, 40045 The Painted Lady,
 * 40046 Domino's Pistol, 40047 Lucky and Good, 40048 Lucky Break, 40049 Probability Field), docs/phase7-wave7.md §7.1,
 * §3.55-§3.58, §3.61. Domino's real precon (`domino-justice`) against Juggernaut through `wave7Scenario` with the real
 * registry. The deck is stacked so every discarded card and icon is known: wild 40040-40042, energy 40052, mental
 * 40053, physical 40055 (one printed icon each; Domino's hero face counts a printed wild twice, §3.56).
 */
const DIAMONDBACK_ACTION = "40038.diamondback-action";
const OUTLAW_INTERRUPT = "40039.outlaw-interrupt";
const PIP_ACTION = "40044.pip-the-pug-action";
const LADY_RESPONSE = "40045.the-painted-lady-response";
const LADY_ACTION = "40045.the-painted-lady-action";
const PISTOL_ACTION = "40046.dominos-pistol-action";
const LUCKY_GOOD = "40047.lucky-and-good-interrupt";
const LUCKY_BREAK = "40048.lucky-break-interrupt";
const FIELD = "40049.probability-field-interrupt";
const ALL_REFS = [
  DIAMONDBACK_ACTION,
  OUTLAW_INTERRUPT,
  PIP_ACTION,
  LADY_RESPONSE,
  LADY_ACTION,
  PISTOL_ACTION,
  LUCKY_GOOD,
  LUCKY_BREAK,
  FIELD,
];

const DOMINO = { starterDeckId: "domino-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof DOMINO | typeof SPIDER_MAN;

const WILD = "40040";
const WILD_3 = "40042";
const ENERGY = "40052";
const MENTAL = "40053";
const PHYSICAL = "40055";
const DIAMONDBACK = "40038";
const OUTLAW = "40039";
const PIP = "40044";
const PAINTED_LADY = "40045";
const PISTOL = "40046";
const LUCKY_AND_GOOD = "40047";
const LUCKY_BREAK_CARD = "40048";
const PROBABILITY_FIELD = "40049";
const GEORGE = "40112"; // Gorgeous George: 4 hit points (Nasty Boys)
const HAIRBAG = "40113"; // Hairbag: 3 hit points
const RAMROD = "40114"; // Ramrod: 4 hit points, Retaliate 1
const WILLOW = "40133"; // Creeping Willow: 1 boost icon and "[star] Boost: You are stunned."
const THRASHING = "40135"; // A Sound Thrashing: 3 boost icons
const BUILDING_MOMENTUM = "40124"; // a side scheme that only sits in the villain area
const CAPTIVE_HOPE = "40131"; // another encounter side scheme
const BLANK = ["01186", "01187"] as const; // boost cards with no icons

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);

function newGame(players: readonly Seat[], modularSetIds: readonly string[] = [], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}
/** Domino in hero form. The game starts in alter-ego form with a hand of 6; `withForm` does not trim it. */
const heroGame = (players: readonly Seat[] = [DOMINO], modularSetIds: readonly string[] = []): GameState =>
  withForm(newGame(players, modularSetIds), { heroForm: 0 });

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;

/** The deck is `deckTopFirst` over the rest of the deck, the hand exactly `hand`, the discard pile empty. */
function stacked(state: GameState, deckTopFirst: readonly string[], hand: readonly string[] = []): GameState {
  const cleared = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.discard, ...p.deck], hand: [], discard: [] } : p,
    ),
  };
  const withHand = hand.length > 0 ? moveToHand(cleared, P1, ...hand).state : cleared;
  return deckTopFirst.length > 0 ? putOnTopOfDeck(withHand, P1, ...deckTopFirst).state : withHand;
}
/** `p`'s hand topped up from the deck to at least `n` cards. */
function fillHand(state: GameState, n: number, player: PlayerId = P1): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerId !== player || p.hand.length >= n) return p;
      const need = n - p.hand.length;
      return { ...p, hand: [...p.hand, ...p.deck.slice(0, need)], deck: p.deck.slice(need) };
    }),
  };
}
/** `code` played from the hand (an upgrade onto `attach`), paying `cost` with other hand cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  attach?: InstanceId,
  player: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const filled = fillHand(state, cost + 1, player);
  const given = moveToHand(filled, player, code);
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    firstLegal,
    play(player, id, payWith(given.state, player, cost, [id]), attach ? { attachToInstanceId: attach } : {}),
  );
  return { state: driven.state, id };
}
/** A pile of `codes` in the discard pile, top first (`PlayerState.discard[0]` is the top; `moveToDiscard` appends). */
function withDiscard(state: GameState, ...pile: string[]): GameState {
  let s = state;
  for (const code of [...pile].reverse()) {
    const moved = moveToDiscard(s, P1, code);
    s = {
      ...moved.state,
      players: moved.state.players.map((p) =>
        p.playerId === P1 ? { ...p, discard: [moved.id, ...p.discard.filter((x) => x !== moved.id)] } : p,
      ),
    };
  }
  return s;
}

/** Accepts every optional response whose id contains one of `wanted`; picks `choose` / `target` where offered. */
const accepting =
  (wanted: readonly string[], opts: { choose?: readonly string[]; target?: readonly InstanceId[] } = {}): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseCards") {
      for (const code of opts.choose ?? []) {
        const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === code);
        if (hit) return [hit.optionId];
      }
    }
    if (choice?.prompt.kind === "chooseTarget") {
      for (const target of opts.target ?? []) {
        const hit = choice.options.find((o) => o.optionId === target);
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(state);
  };
/** Runs `commands` and records every response id offered on the way. */
function drive(
  state: GameState,
  pick: Picker,
  ...commands: Command[]
): { state: GameState; events: readonly GameEvent[]; offered: string[] } {
  const offered: string[] = [];
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.push(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return { ...result, offered };
}
const offeredCount = (offered: readonly string[], ref: string): number => offered.filter((o) => o.includes(ref)).length;
const events = <T extends GameEvent["type"]>(log: readonly GameEvent[], type: T) =>
  log.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const basicAttack = (player: PlayerId, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicRecover: Command = { type: "basicRecover", playerId: P1 };

describe("Domino allies, supports and upgrades registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(DOMINO_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly the nine refs of 40038, 40039 and 40044-40049", () => {
    expect(Object.keys(DOMINO_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
});

describe("Diamondback (40038)", () => {
  /** Diamondback in play (ready, undamaged), the villain without its tough status, the deck stacked. */
  function board(deck: readonly string[], players: readonly Seat[] = [DOMINO], form: "hero" | "alterEgo" = "hero") {
    const base = withoutTough(heroGame(players, ["nasty_boys"]));
    const { state: played, id } = put(base, DIAMONDBACK, 2);
    const minion = engageMinion(played, GEORGE, P1);
    const state = stacked(minion.state, deck, [WILD_3]);
    return { state: form === "hero" ? state : withForm(state, "alterEgo"), id, minion: minion.id };
  }
  const act = (state: GameState, id: InstanceId, pick: Picker = firstLegal) =>
    driveEventsPicking(WAVE7_DEPS, state, pick, use(P1, id, DIAMONDBACK_ACTION));

  it("costs 2 and enters play ready with 2 hit points", () => {
    const base = heroGame();
    const { state, id } = put(base, DIAMONDBACK, 2);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
    expect(discardCodes(state)).toHaveLength(2);
  });

  it("hero form, a wild on top: she exhausts and takes 1 damage, then deals 2 damage to each enemy", () => {
    const g = board([WILD, ENERGY]);
    const { state: after } = act(g.state, g.id);
    expect(inst(after, g.id).exhausted).toBe(true);
    expect(damageOf(after, g.id)).toBe(1);
    expect(damageOf(after, villainOf(after))).toBe(2);
    expect(damageOf(after, g.minion)).toBe(2);
    expect(discardCodes(after)).toEqual([WILD]);
    expect(deckCodes(after)[0]).toBe(ENERGY);
  });

  it.each([
    [ENERGY, 1],
    [MENTAL, 1],
    [PHYSICAL, 1],
  ])("hero form, a printed %s icon counts once: %d damage to each enemy", (code, expected) => {
    const g = board([code, WILD]);
    const { state: after } = act(g.state, g.id);
    expect(damageOf(after, villainOf(after))).toBe(expected);
    expect(damageOf(after, g.minion)).toBe(expected);
    expect(discardCodes(after)).toEqual([code]);
  });

  it("alter-ego form: the wild counts once (Domino's rule is printed on the hero face)", () => {
    const g = board([WILD], [DOMINO], "alterEgo");
    const { state: after } = act(g.state, g.id);
    expect(damageOf(after, villainOf(after))).toBe(1);
    expect(damageOf(after, g.minion)).toBe(1);
  });

  it("it is not an attack: the minion's tough status is not needed for Retaliate and nothing retaliates", () => {
    const base = withoutTough(heroGame([DOMINO], ["nasty_boys"]));
    const { state: played, id } = put(base, DIAMONDBACK, 2);
    const ramrod = engageMinion(played, RAMROD, P1);
    const state = stacked(ramrod.state, [ENERGY, WILD], [WILD_3]);
    const { state: after } = act(state, id);
    expect(damageOf(after, ramrod.id)).toBe(1);
    // Only the 1 damage her own cost dealt to her.
    expect(damageOf(after, identityOf(after, P1))).toBe(0);
    expect(damageOf(after, id)).toBe(1);
  });

  it("a tough enemy loses its tough status card instead of taking the damage", () => {
    const base = heroGame([DOMINO], ["nasty_boys"]);
    expect(inst(base, villainOf(base)).statuses.tough).toBe(1);
    const { state: played, id } = put(base, DIAMONDBACK, 2);
    const state = stacked(played, [ENERGY], [WILD_3]);
    const { state: after } = act(state, id);
    expect(damageOf(after, villainOf(after))).toBe(0);
    expect(inst(after, villainOf(after)).statuses.tough).toBe(0);
  });

  it("still resolves when the 1 damage she takes defeats her (MC40 p. 21)", () => {
    const g = board([WILD, ENERGY]);
    const hurt = withDamage(g.state, g.id, 1);
    const { state: after } = act(hurt, g.id);
    expect(playerOf(after, P1).playArea).not.toContain(g.id);
    expect(damageOf(after, villainOf(after))).toBe(2);
    expect(damageOf(after, g.minion)).toBe(2);
  });

  it("is refused while she is exhausted", () => {
    const g = board([WILD, ENERGY]);
    const { state: used } = act(g.state, g.id);
    expect(refused(used, use(P1, g.id, DIAMONDBACK_ACTION))).toBe(true);
  });

  it("an empty deck and discard pile: the cost cannot be paid, nothing happens", () => {
    const g = board([]);
    const empty = {
      ...g.state,
      players: g.state.players.map((p) => ({ ...p, deck: [], discard: [] })),
    } as GameState;
    expect(refused(empty, use(P1, g.id, DIAMONDBACK_ACTION))).toBe(true);
    expect(damageOf(empty, villainOf(empty))).toBe(0);
  });

  it("two players: only her controller's deck is discarded from, every enemy takes the damage", () => {
    const base = withoutTough(heroGame([DOMINO, SPIDER_MAN], ["nasty_boys"]));
    const { state: played, id } = put(base, DIAMONDBACK, 2);
    const george = engageMinion(played, GEORGE, P2);
    const state = stacked(george.state, [WILD, ENERGY], [WILD_3]);
    const otherDeck = playerOf(state, P2).deck;
    const otherHand = playerOf(state, P2).hand;
    const { state: after } = act(state, id);
    expect(damageOf(after, george.id)).toBe(2);
    expect(damageOf(after, villainOf(after))).toBe(2);
    expect(playerOf(after, P2).deck).toEqual(otherDeck);
    expect(playerOf(after, P2).hand).toEqual(otherHand);
    expect(playerOf(after, P2).discard).toEqual([]);
  });
});

describe("Outlaw (40039)", () => {
  /** Outlaw in play (cost 3), the villain without tough, the deck stacked. */
  function board(deck: readonly string[], players: readonly Seat[] = [DOMINO]) {
    const base = withoutTough(heroGame(players));
    const { state: played, id } = put(base, OUTLAW, 3);
    return { state: stacked(played, deck, [WILD_3]), id };
  }
  const attackWith = (state: GameState, outlaw: InstanceId, accept: boolean) =>
    drive(state, accept ? accepting([OUTLAW_INTERRUPT]) : accepting([]), basicAttack(P1, outlaw, villainOf(state)));

  it("costs 3 and enters play with Toughness: a tough status card", () => {
    const base = heroGame();
    const { state, id } = put(base, OUTLAW, 3);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).statuses.tough).toBe(1);
  });

  it("declined: a basic attack deals her 1 ATK and the deck is untouched", () => {
    const g = board([WILD, ENERGY]);
    const run = attackWith(g.state, g.id, false);
    expect(damageOf(run.state, villainOf(run.state))).toBe(1);
    expect(discardCodes(run.state)).toEqual([]);
    expect(deckCodes(run.state)[0]).toBe(WILD);
  });

  it("hero form, a wild discarded: +2 ATK, 3 damage in all", () => {
    const g = board([WILD, ENERGY]);
    const run = attackWith(g.state, g.id, true);
    expect(offeredCount(run.offered, OUTLAW_INTERRUPT)).toBe(1);
    expect(damageOf(run.state, villainOf(run.state))).toBe(3);
    expect(discardCodes(run.state)).toEqual([WILD]);
  });

  it.each([
    [ENERGY, 2],
    [MENTAL, 2],
    [PHYSICAL, 2],
  ])("hero form, a printed %s icon discarded: +1 ATK, %d damage in all", (code, expected) => {
    const g = board([code, WILD]);
    const run = attackWith(g.state, g.id, true);
    expect(damageOf(run.state, villainOf(run.state))).toBe(expected);
  });

  it("alter-ego form: the wild counts once, +1 ATK, 2 damage", () => {
    const g = board([WILD, ENERGY]);
    const run = attackWith(withForm(g.state, "alterEgo"), g.id, true);
    expect(damageOf(run.state, villainOf(run.state))).toBe(2);
  });

  it("the bonus lasts for that attack only: the next attack, declined, deals 1", () => {
    const g = board([WILD, ENERGY]);
    const first = attackWith(g.state, g.id, true);
    const ready = patchInstance(first.state, g.id, { exhausted: false });
    const second = attackWith(ready, g.id, false);
    expect(damageOf(second.state, villainOf(second.state))).toBe(4);
  });

  it("an empty deck and discard pile: the interrupt is not offered and the attack deals 1", () => {
    const g = board([]);
    const empty = { ...g.state, players: g.state.players.map((p) => ({ ...p, deck: [], discard: [] })) } as GameState;
    const run = attackWith(empty, g.id, true);
    expect(offeredCount(run.offered, OUTLAW_INTERRUPT)).toBe(0);
    expect(damageOf(run.state, villainOf(run.state))).toBe(1);
  });

  it("two players: only her controller's deck is discarded from", () => {
    const g = board([WILD, ENERGY], [DOMINO, SPIDER_MAN]);
    const otherDeck = playerOf(g.state, P2).deck;
    const run = attackWith(g.state, g.id, true);
    expect(damageOf(run.state, villainOf(run.state))).toBe(3);
    expect(playerOf(run.state, P2).deck).toEqual(otherDeck);
  });
});

describe("Pip the Pug (40044)", () => {
  /** Pip in play, alter-ego form, `pile` in the discard pile (top first). */
  function board(...pile: string[]) {
    const base = heroGame();
    const { state: played, id } = put(base, PIP, 1);
    const cleared = stacked(played, [MENTAL], [WILD_3]);
    return { state: withForm(withDiscard(cleared, ...pile), "alterEgo"), id };
  }
  const act = (state: GameState, id: InstanceId, choose: readonly string[]) =>
    driveEventsPicking(WAVE7_DEPS, state, accepting([], { choose }), use(P1, id, PIP_ACTION));

  it("costs 1; Alter-Ego Action: exhaust, a Domino card from the discard pile goes on top of the deck", () => {
    const g = board(WILD, ENERGY);
    const { state: after } = act(g.state, g.id, [WILD]);
    expect(inst(after, g.id).exhausted).toBe(true);
    expect(deckCodes(after)[0]).toBe(WILD);
    expect(deckCodes(after)[1]).toBe(MENTAL);
    expect(discardCodes(after)).toEqual([ENERGY]);
  });

  it("a POSSE card qualifies: Diamondback from the discard pile", () => {
    const g = board(ENERGY, DIAMONDBACK);
    const { state: after } = act(g.state, g.id, [DIAMONDBACK]);
    expect(deckCodes(after)[0]).toBe(DIAMONDBACK);
    expect(discardCodes(after)).toEqual([ENERGY]);
  });

  it("a card that is neither Domino nor POSSE (Take Out the Guards 40054) cannot be chosen: nothing to return", () => {
    const g = board("40054");
    expect(refused(g.state, use(P1, g.id, PIP_ACTION))).toBe(true);
    expect(inst(g.state, g.id).exhausted).toBe(false);
  });

  it("only the eligible card of a mixed pile is offered", () => {
    const g = board("40054", ENERGY, WILD);
    const offered: string[] = [];
    const spy: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards")
        offered.push(...s.pendingChoice.options.map((o) => codeOf(s, o.optionId as InstanceId)));
      return firstLegal(s);
    };
    const { state: after } = driveEventsPicking(WAVE7_DEPS, g.state, spy, use(P1, g.id, PIP_ACTION));
    expect(offered).toEqual([WILD]);
    expect(deckCodes(after)[0]).toBe(WILD);
  });

  it("an empty discard pile: refused", () => {
    const g = board();
    expect(refused(g.state, use(P1, g.id, PIP_ACTION))).toBe(true);
  });

  it("is an alter-ego action: refused in hero form", () => {
    const g = board(WILD);
    expect(refused(withForm(g.state, { heroForm: 0 }), use(P1, g.id, PIP_ACTION))).toBe(true);
  });

  it("two players: only the user's discard pile and deck are touched", () => {
    const base = heroGame([DOMINO, SPIDER_MAN]);
    const { state: played, id } = put(base, PIP, 1);
    const state = withForm(withDiscard(stacked(played, [MENTAL], [WILD_3]), WILD), "alterEgo");
    const otherDeck = playerOf(state, P2).deck;
    const otherDiscard = playerOf(state, P2).discard;
    const { state: after } = act(state, id, [WILD]);
    expect(deckCodes(after)[0]).toBe(WILD);
    expect(playerOf(after, P2).deck).toEqual(otherDeck);
    expect(playerOf(after, P2).discard).toEqual(otherDiscard);
  });
});

describe("The Painted Lady (40045)", () => {
  /** The Painted Lady and Diamondback in play, the villain without tough, the deck stacked. */
  function board(deck: readonly string[], players: readonly Seat[] = [DOMINO]) {
    const base = withoutTough(heroGame(players));
    const lady = put(base, PAINTED_LADY, 1);
    const ally = put(lady.state, DIAMONDBACK, 2);
    return { state: stacked(ally.state, deck, [WILD_3]), lady: lady.id, ally: ally.id };
  }
  const discardWith = (state: GameState, ally: InstanceId, accept: boolean) =>
    drive(state, accept ? accepting([LADY_RESPONSE]) : accepting([]), use(P1, ally, DIAMONDBACK_ACTION));
  const attached = (s: GameState, lady: InstanceId): string[] => codes(s, inst(s, lady).attachments);

  it("costs 1; after you discard a card from the top of your deck, attach it facedown here", () => {
    const g = board([ENERGY, MENTAL]);
    const run = discardWith(g.state, g.ally, true);
    expect(offeredCount(run.offered, LADY_RESPONSE)).toBe(1);
    expect(attached(run.state, g.lady)).toEqual([ENERGY]);
    const card = inst(run.state, inst(run.state, g.lady).attachments[0]!);
    expect(card.facedownAs).toBeTruthy();
    expect(card.attachedTo).toBe(g.lady);
    expect(discardCodes(run.state)).toEqual([]);
  });

  it("declined: the card stays in the discard pile", () => {
    const g = board([ENERGY, MENTAL]);
    const run = discardWith(g.state, g.ally, false);
    expect(attached(run.state, g.lady)).toEqual([]);
    expect(discardCodes(run.state)).toEqual([ENERGY]);
  });

  it("to a maximum of 3: with three attached, a fourth discard does not offer the Response", () => {
    const g = board([ENERGY, MENTAL, PHYSICAL, WILD]);
    let s = g.state;
    for (const _ of [0, 1, 2]) {
      const run = discardWith(s, g.ally, true);
      expect(offeredCount(run.offered, LADY_RESPONSE)).toBe(1);
      s = patchInstance(run.state, g.ally, { exhausted: false, damage: 0 });
    }
    expect(attached(s, g.lady)).toEqual([ENERGY, MENTAL, PHYSICAL]);
    const fourth = discardWith(s, g.ally, true);
    expect(offeredCount(fourth.offered, LADY_RESPONSE)).toBe(0);
    expect(attached(fourth.state, g.lady)).toHaveLength(3);
    expect(discardCodes(fourth.state)).toEqual([WILD]);
  });

  it("any discard from the top of your deck counts, whoever's card causes it: Probability Field's basic attack", () => {
    const g = board([ENERGY, MENTAL]);
    const field = put(g.state, PROBABILITY_FIELD, 2, identityOf(g.state, P1));
    const state = stacked(field.state, [MENTAL, ENERGY], [WILD_3]);
    const run = drive(
      state,
      accepting([FIELD, LADY_RESPONSE]),
      basicAttack(P1, identityOf(state, P1), villainOf(state)),
    );
    expect(attached(run.state, g.lady)).toEqual([MENTAL]);
  });

  it("a deck emptied by the discard resets, and the card is attached from the new deck (§3.55, Q33)", () => {
    const g = board([ENERGY]);
    const lone = {
      ...g.state,
      players: g.state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [p.deck[0]!], discard: [] } : p)),
    } as GameState;
    expect(deckCodes(lone)).toEqual([ENERGY]);
    const run = discardWith(lone, g.ally, true);
    expect(attached(run.state, g.lady)).toEqual([ENERGY]);
  });

  it("Alter-Ego Action: exhaust, add 1 attached card to your hand (the owner's choice)", () => {
    const g = board([ENERGY, MENTAL]);
    const a = discardWith(g.state, g.ally, true).state;
    const b = discardWith(patchInstance(a, g.ally, { exhausted: false, damage: 0 }), g.ally, true).state;
    expect(attached(b, g.lady)).toEqual([ENERGY, MENTAL]);
    const alter = withForm(b, "alterEgo");
    const { state: after } = driveEventsPicking(
      WAVE7_DEPS,
      alter,
      accepting([], { choose: [MENTAL] }),
      use(P1, g.lady, LADY_ACTION),
    );
    expect(inst(after, g.lady).exhausted).toBe(true);
    expect(handCodes(after)).toContain(MENTAL);
    expect(attached(after, g.lady)).toEqual([ENERGY]);
    expect(
      inst(
        after,
        playerOf(after, P1).hand.find((id) => codeOf(after, id) === MENTAL)!,
      ).facedownAs,
    ).toBeFalsy();
  });

  it("the Action needs an attached card and alter-ego form", () => {
    const g = board([ENERGY]);
    expect(refused(withForm(g.state, "alterEgo"), use(P1, g.lady, LADY_ACTION))).toBe(true);
    const run = discardWith(g.state, g.ally, true);
    expect(refused(run.state, use(P1, g.lady, LADY_ACTION))).toBe(true);
  });

  it("two players: the other player's deck is untouched and is never offered the Response", () => {
    const g = board([ENERGY, MENTAL], [DOMINO, SPIDER_MAN]);
    const otherDeck = playerOf(g.state, P2).deck;
    const run = discardWith(g.state, g.ally, true);
    expect(attached(run.state, g.lady)).toEqual([ENERGY]);
    expect(playerOf(run.state, P2).deck).toEqual(otherDeck);
    expect(offeredCount(run.offered, LADY_RESPONSE)).toBe(1);
  });
});

describe("Domino's Pistol (40046)", () => {
  /** The Pistol attached to Domino's identity (cost 2), Ramrod (Retaliate 1) and George engaged, deck stacked. */
  function board(deck: readonly string[], players: readonly Seat[] = [DOMINO]) {
    const base = withoutTough(heroGame(players, ["nasty_boys"]));
    const { state: played, id } = put(base, PISTOL, 2, identityOf(base, P1));
    const ramrod = engageMinion(played, RAMROD, P1);
    const george = engageMinion(ramrod.state, GEORGE, P1);
    return { state: stacked(george.state, deck, [WILD_3]), id, ramrod: ramrod.id, george: george.id };
  }
  const shoot = (state: GameState, pistol: InstanceId, target: InstanceId) =>
    driveEventsPicking(WAVE7_DEPS, state, accepting([], { target: [target] }), use(P1, pistol, PISTOL_ACTION));

  it("costs 2 and attaches to the identity", () => {
    const g = board([WILD]);
    expect(inst(g.state, g.id).attachedTo).toBe(identityOf(g.state, P1));
  });

  it("hero form, a wild discarded: exhaust, 2 damage to the chosen enemy only", () => {
    const g = board([WILD, ENERGY]);
    const { state: after } = shoot(g.state, g.id, g.george);
    expect(inst(after, g.id).exhausted).toBe(true);
    expect(damageOf(after, g.george)).toBe(2);
    expect(damageOf(after, g.ramrod)).toBe(0);
    expect(damageOf(after, villainOf(after))).toBe(0);
    expect(discardCodes(after)).toEqual([WILD]);
  });

  it.each([
    [ENERGY, 1],
    [MENTAL, 1],
    [PHYSICAL, 1],
  ])("a printed %s icon counts once: %d damage", (code, expected) => {
    const g = board([code, WILD]);
    const { state: after } = shoot(g.state, g.id, g.george);
    expect(damageOf(after, g.george)).toBe(expected);
  });

  it("the attack gains ranged: Ramrod's Retaliate 1 deals no damage to Domino", () => {
    const g = board([ENERGY, WILD]);
    const { state: after } = shoot(g.state, g.id, g.ramrod);
    expect(damageOf(after, g.ramrod)).toBe(1);
    expect(damageOf(after, identityOf(after, P1))).toBe(0);
  });

  it("control: a basic attack on Ramrod does draw the Retaliate", () => {
    const g = board([ENERGY, WILD]);
    const { state: after } = driveEventsPicking(
      WAVE7_DEPS,
      g.state,
      firstLegal,
      basicAttack(P1, identityOf(g.state, P1), g.ramrod),
    );
    expect(damageOf(after, identityOf(after, P1))).toBe(1);
  });

  it("a tough enemy loses its status card instead of taking the attack's damage", () => {
    const g = board([ENERGY, WILD]);
    const toughened = patchInstance(g.state, g.george, { statuses: { ...inst(g.state, g.george).statuses, tough: 1 } });
    const { state: after } = shoot(toughened, g.id, g.george);
    expect(damageOf(after, g.george)).toBe(0);
    expect(inst(after, g.george).statuses.tough).toBe(0);
  });

  it("is a hero action: refused in alter-ego form, and while exhausted", () => {
    const g = board([WILD, ENERGY]);
    expect(refused(withForm(g.state, "alterEgo"), use(P1, g.id, PISTOL_ACTION))).toBe(true);
    const { state: used } = shoot(g.state, g.id, g.george);
    expect(refused(used, use(P1, g.id, PISTOL_ACTION))).toBe(true);
  });

  it("an empty deck and discard pile: the cost cannot be paid", () => {
    const g = board([]);
    const empty = { ...g.state, players: g.state.players.map((p) => ({ ...p, deck: [], discard: [] })) } as GameState;
    expect(refused(empty, use(P1, g.id, PISTOL_ACTION))).toBe(true);
  });

  it("two players: only the user's deck is discarded from; the other player's engaged enemy may be chosen", () => {
    const base = board([WILD, ENERGY], [DOMINO, SPIDER_MAN]);
    const theirs = engageMinion(base.state, HAIRBAG, P2);
    const otherDeck = playerOf(theirs.state, P2).deck;
    const { state: after } = shoot(theirs.state, base.id, theirs.id);
    expect(damageOf(after, theirs.id)).toBe(2);
    expect(playerOf(after, P2).deck).toEqual(otherDeck);
  });
});

describe("Lucky and Good (40047)", () => {
  /** Lucky and Good on Domino's identity, Juggernaut's attack with `boost` flipped for it, then `rest` of the stack. */
  function board(players: readonly Seat[] = [DOMINO]) {
    const base = withForm(newGame(players, ["black_tom_cassidy"]), { heroForm: 0 });
    const calm = patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
    const { state, id } = put(calm, LUCKY_AND_GOOD, 1, identityOf(calm, P1));
    return { state, id };
  }
  /** The villain's phase: both players end the turn; `defend` is declined; Lucky and Good accepted when `accept`. */
  function villainPhase(state: GameState, stack: readonly string[], accept: boolean) {
    const decline: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : accepting(accept ? [LUCKY_GOOD] : [])(s);
    const set = stackEncounterDeck(state, ...stack);
    return drive(set, decline, ...state.players.map((p) => endTurn(p.playerId)));
  }
  const attacks = (log: readonly GameEvent[], enemy: InstanceId) =>
    events(log, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

  it("control: Juggernaut's attack with a Willow boost deals 3 + 1 and stuns you", () => {
    const g = board();
    const run = villainPhase(g.state, [WILLOW, BLANK[1], BUILDING_MOMENTUM], false);
    expect(attacks(run.events, villainOf(g.state))[0]).toMatchObject({ baseAtk: 3, boostIcons: 1, damageDealt: 4 });
    expect(inst(run.state, identityOf(g.state, P1)).statuses.stunned).toBe(1);
    expect(inst(run.state, g.id).exhausted).toBe(false);
  });

  it("cancels the icons and the Boost ability, exhausts, and flips another boost card for this attack", () => {
    const g = board();
    const run = villainPhase(g.state, [WILLOW, THRASHING, BUILDING_MOMENTUM], true);
    expect(offeredCount(run.offered, LUCKY_GOOD)).toBeGreaterThanOrEqual(1);
    // Willow's icon and its stun are cancelled; the other boost card (3 icons) is the one that counts.
    expect(attacks(run.events, villainOf(g.state))[0]).toMatchObject({ baseAtk: 3, boostIcons: 3, damageDealt: 6 });
    expect(inst(run.state, identityOf(g.state, P1)).statuses.stunned).toBe(0);
    expect(inst(run.state, g.id).exhausted).toBe(true);
  });

  it("with a blank second card the attack is just the base ATK", () => {
    const g = board();
    const run = villainPhase(g.state, [WILLOW, BLANK[0], BUILDING_MOMENTUM], true);
    expect(attacks(run.events, villainOf(g.state))[0]).toMatchObject({ baseAtk: 3, boostIcons: 0, damageDealt: 3 });
  });

  it("is a Hero Interrupt (defense): not offered in alter-ego form", () => {
    const g = board();
    const alter = withForm(g.state, "alterEgo");
    const run = villainPhase(alter, [WILLOW, BLANK[0], BUILDING_MOMENTUM], true);
    expect(offeredCount(run.offered, LUCKY_GOOD)).toBe(0);
  });

  it("two players: offered once per attack against its owner, never for an attack against the other player", () => {
    const g = board([DOMINO, SPIDER_MAN]);
    const both = withForm(g.state, { heroForm: 0 }, P2);
    const run = villainPhase(both, [BLANK[0], WILLOW, BLANK[1], BUILDING_MOMENTUM, CAPTIVE_HOPE], false);
    const resolved = events(run.events, "attackResolved");
    const mine = resolved.filter((e) => e.targetInstanceId === identityOf(both, P1)).length;
    const theirs = resolved.filter((e) => e.targetInstanceId === identityOf(both, P2)).length;
    expect(theirs).toBeGreaterThanOrEqual(1);
    expect(mine).toBeGreaterThanOrEqual(1);
    expect(offeredCount(run.offered, LUCKY_GOOD)).toBe(mine);
  });
});

describe("Lucky Break (40048)", () => {
  /** Lucky Break on Domino's identity (cost 0), the main scheme calm. */
  function board(players: readonly Seat[] = [DOMINO]) {
    const base = withForm(newGame(players, ["black_tom_cassidy"]), { heroForm: 0 });
    const calm = patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
    const { state, id } = put(calm, LUCKY_BREAK_CARD, 0, identityOf(calm, P1));
    return { state, id };
  }
  function phase(state: GameState, stack: readonly string[], accept: boolean) {
    const decline: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : accepting(accept ? [LUCKY_BREAK] : [])(s);
    const forms = state.players.reduce((s, p) => withForm(s, { heroForm: 0 }, p.playerId), state);
    return drive(stackEncounterDeck(forms, ...stack), decline, ...state.players.map((p) => endTurn(p.playerId)));
  }
  const revealed = (log: readonly GameEvent[]): string[] =>
    events(log, "encounterCardRevealed").map((e) => e.cardId as string);

  it("costs 0; control: without it the revealed card resolves", () => {
    const g = board();
    const run = phase(g.state, [BLANK[0], BUILDING_MOMENTUM, CAPTIVE_HOPE], false);
    expect(revealed(run.events)).toEqual([BUILDING_MOMENTUM]);
    expect(run.state.villainArea.map((id) => codeOf(run.state, id))).toContain(BUILDING_MOMENTUM);
  });

  it("discard it: the revealed card is cancelled and discarded, and another is revealed", () => {
    const g = board();
    const run = phase(g.state, [BLANK[0], BUILDING_MOMENTUM, CAPTIVE_HOPE], true);
    const area = run.state.villainArea.map((id) => codeOf(run.state, id));
    expect(area).not.toContain(BUILDING_MOMENTUM);
    expect(area).toContain(CAPTIVE_HOPE);
    expect(discardedEncounter(run.state)).toContain(BUILDING_MOMENTUM);
    // Lucky Break was discarded to pay for it.
    expect(discardCodes(run.state)).toContain(LUCKY_BREAK_CARD);
    expect(playerOf(run.state, P1).playArea).not.toContain(g.id);
    expect(inst(run.state, identityOf(run.state, P1)).attachments).not.toContain(g.id);
  });

  it("is a Hero Interrupt: not offered in alter-ego form", () => {
    const g = board();
    const alter = withForm(g.state, "alterEgo");
    const set = stackEncounterDeck(alter, BLANK[0], BUILDING_MOMENTUM, CAPTIVE_HOPE);
    const run = drive(set, accepting([LUCKY_BREAK]), endTurn(P1));
    expect(offeredCount(run.offered, LUCKY_BREAK)).toBe(0);
    expect(run.state.villainArea.map((id) => codeOf(run.state, id))).toContain(BUILDING_MOMENTUM);
  });

  it("two players: offered only for its owner's reveal, not the other player's", () => {
    const g = board([DOMINO, SPIDER_MAN]);
    const run = phase(g.state, [BLANK[0], BLANK[1], BUILDING_MOMENTUM, CAPTIVE_HOPE], false);
    expect(offeredCount(run.offered, LUCKY_BREAK)).toBe(1);
  });
});

/** Cards in the active villain's encounter discard pile, by printed id. */
function discardedEncounter(state: GameState): string[] {
  return Object.values(state.encounterDecks).flatMap((pile) => pile.discard.map((id) => codeOf(state, id)));
}

describe("Probability Field (40049)", () => {
  /** Probability Field on Domino's identity (cost 2); main scheme at 10 threat; the villain without tough. */
  function board(deck: readonly string[], players: readonly Seat[] = [DOMINO]) {
    const base = withoutTough(heroGame(players));
    const threatened = patchInstance(base, base.mainScheme.instanceId, { threat: 10 });
    const { state: played, id } = put(threatened, PROBABILITY_FIELD, 2, identityOf(base, P1));
    return { state: stacked(played, deck, [WILD_3]), id };
  }
  const attackIt = (state: GameState, accept: boolean) =>
    drive(state, accept ? accepting([FIELD]) : accepting([]), basicAttack(P1, identityOf(state, P1), villainOf(state)));

  it("costs 2; declined, Domino's basic attack deals her 2 ATK", () => {
    const g = board([WILD, ENERGY]);
    expect(inst(g.state, g.id).attachedTo).toBe(identityOf(g.state, P1));
    const run = attackIt(g.state, false);
    expect(damageOf(run.state, villainOf(run.state))).toBe(2);
    expect(discardCodes(run.state)).toEqual([]);
  });

  it("hero form, a wild discarded: +2 to the attack, 4 damage", () => {
    const g = board([WILD, ENERGY]);
    const run = attackIt(g.state, true);
    expect(offeredCount(run.offered, FIELD)).toBe(1);
    expect(damageOf(run.state, villainOf(run.state))).toBe(4);
    expect(discardCodes(run.state)).toEqual([WILD]);
  });

  it.each([
    [ENERGY, 3],
    [MENTAL, 3],
    [PHYSICAL, 3],
  ])("a printed %s icon counts once: %d damage", (code, expected) => {
    const g = board([code, WILD]);
    const run = attackIt(g.state, true);
    expect(damageOf(run.state, villainOf(run.state))).toBe(expected);
  });

  it("any basic power: a basic thwart (THW 1) with a wild removes 3 threat", () => {
    const g = board([WILD, ENERGY]);
    const main = g.state.mainScheme.instanceId;
    const run = drive(g.state, accepting([FIELD]), basicThwart(P1, identityOf(g.state, P1), main));
    expect(inst(run.state, main).threat).toBe(7);
  });

  it("alter-ego form: a basic recovery (REC 3) with a wild discarded heals 3 + 1", () => {
    const g = board([WILD, ENERGY]);
    const hurt = withDamage(withForm(g.state, "alterEgo"), identityOf(g.state, P1), 6);
    const run = drive(hurt, accepting([FIELD]), basicRecover);
    expect(offeredCount(run.offered, FIELD)).toBe(1);
    expect(discardCodes(run.state)).toEqual([WILD]);
    expect(damageOf(run.state, identityOf(run.state, P1))).toBe(2);
  });

  it("the bonus is for that use only: the next attack, declined, deals 2", () => {
    const g = board([WILD, ENERGY]);
    const first = attackIt(g.state, true);
    const ready = patchInstance(first.state, identityOf(first.state, P1), { exhausted: false });
    const second = attackIt(ready, false);
    expect(damageOf(second.state, villainOf(second.state))).toBe(6);
  });

  it("your identity's powers only: an ally's basic attack does not offer it", () => {
    const base = withoutTough(heroGame());
    const field = put(base, PROBABILITY_FIELD, 2, identityOf(base, P1));
    const ally = put(field.state, DIAMONDBACK, 2);
    const state = stacked(ally.state, [WILD, ENERGY], [WILD_3]);
    const run = drive(state, accepting([FIELD]), basicAttack(P1, ally.id, villainOf(state)));
    expect(offeredCount(run.offered, FIELD)).toBe(0);
    expect(discardCodes(run.state)).toEqual([]);
  });

  it("an empty deck and discard pile: not offered, the attack deals 2", () => {
    const g = board([]);
    const empty = { ...g.state, players: g.state.players.map((p) => ({ ...p, deck: [], discard: [] })) } as GameState;
    const run = attackIt(empty, true);
    expect(offeredCount(run.offered, FIELD)).toBe(0);
    expect(damageOf(run.state, villainOf(run.state))).toBe(2);
  });

  it("two players: another player's basic attack does not offer it and their deck is untouched", () => {
    const g = board([WILD, ENERGY], [DOMINO, SPIDER_MAN]);
    const turned = driveEventsPicking(WAVE7_DEPS, g.state, firstLegal, endTurn(P1)).state;
    const hero2 = withForm(turned, { heroForm: 0 }, P2);
    const otherDeck = playerOf(hero2, P2).deck;
    const run = drive(hero2, accepting([FIELD]), basicAttack(P2, identityOf(hero2, P2), villainOf(hero2)));
    expect(offeredCount(run.offered, FIELD)).toBe(0);
    expect(playerOf(run.state, P2).deck).toEqual(otherDeck);
    expect(damageOf(run.state, villainOf(run.state))).toBe(2);
  });
});
