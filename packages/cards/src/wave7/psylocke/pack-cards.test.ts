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
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { PSYLOCKE_PACK_CARDS } from "./pack-cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The psylocke pack's other cards, docs/phase7-wave7.md §7.2, §3.57, §3.72: Psi-Bow Attack 41030, Domino 41031,
 * Psi-Flail Strike 41032 and Telekinesis 41033. They are not in Psylocke's starter deck, so each is moved into the hand
 * (or attached by surgery). Her real precon (`psylocke-justice`) against Stryfe, the retaliate-1 minion Arclight (40094,
 * Mutant Slayers) staged unengaged as a second enemy. Cable (PSIONIC only while Technovirus Purge is in the victory display) and Spider-Man (not PSIONIC) are
 * the other identities.
 */
const BOW_CONSTANT = "41030.psi-bow-attack-constant";
const BOW = "41030.psi-bow-attack-action";
const DOMINO = "41031.domino-response";
const FLAIL = "41032.psi-flail-strike-response";
const KINESIS = "41033.telekinesis-action";
const KNIFE_RESOURCE = "41002a.psi-knife-resource";
const ALL = [BOW_CONSTANT, BOW, DOMINO, FLAIL, KINESIS];

const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof PSYLOCKE | typeof CABLE | typeof SPIDER_MAN;
const ARCLIGHT = "40094";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const stunned = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned ?? 0;
const bladesOf = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === "41002a");
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

let conjured = 9100;
/**
 * A copy of `code` (not in her starter deck) added to the player's hand by surgery: a fresh instance cloned from a card
 * of that player's own deck, so ownership and home are right, with the printed number replaced.
 */
function conjure(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, player);
  const template = inst(state, owner.deck[0]!);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: code as never,
    exhausted: false,
    flipped: false,
    attachments: [],
  };
  return {
    ids: [id],
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}

/** The seat in hero form, Stryfe without his starting tough card, Arclight (retaliate 1) staged unengaged. */
function game(players: readonly Seat[] = [PSYLOCKE], seat: PlayerId = P1) {
  const config = wave7Scenario("stryfe", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: ["mutant_slayers"],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 }, seat);
  const quiet = patchInstance(hero, stryfe(hero), { statuses: { ...inst(hero, stryfe(hero)).statuses, tough: 0 } });
  const arclight = encounterCardInVillainArea(quiet, ARCLIGHT);
  return { state: arclight.state, arclight: arclight.id };
}
/** Picks `id` for the first prompt that offers it (a target, a card); everything else as `firstLegal`. */
const picking =
  (...ids: readonly InstanceId[]): Picker =>
  (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    const hit = ids.find((id) => offered.includes(id));
    return hit ? [hit] : firstLegal(s);
  };
/** Accepts the optional trigger whose id contains `ability` and pays its cost from hand cards; other prompts as `inner`. */
const accepting =
  (ability: string, inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(ability));
      return hit ? [hit.optionId] : [];
    }
    if (choice?.prompt.kind === "declareDefender") return [identityOf(s, choice.playerId)];
    return inner(s);
  };
/** End-of-turn discard down to hand size that never discards the given cards (by printed number). */
const keeping =
  (inner: Picker, ...codes: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "discardDownToHandSize") return inner(s);
    return choice.options
      .filter((o) => !codes.includes(codeOf(s, o.optionId as InstanceId)))
      .slice(0, choice.minSelections)
      .map((o) => o.optionId);
  };
/** Technovirus Purge (40006) into the victory display: Cable's faces gain PSIONIC while it is there (Cable 40001). */
function withPurgeWon(state: GameState): GameState {
  const purge = Object.values(state.instances).find((i) => i.cardId === "40006")!.instanceId;
  return {
    ...patchInstance(state, purge, { threat: 0 }),
    villainArea: state.villainArea.filter((x) => x !== purge),
    victoryDisplay: [...state.victoryDisplay, purge],
  };
}
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;

/** Plays the event `code` for `cost` from hand with other hand cards as payment. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker = firstLegal, player: PlayerId = P1) {
  const given = conjure(state, player, code);
  const [id] = given.ids as [InstanceId];
  const run = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    pick,
    play(player, id, payWith(given.state, player, cost, [id])),
  );
  return { ...run, id, before: given.state };
}
const refusedPlay = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const given = conjure(state, player, code);
  const [id] = given.ids as [InstanceId];
  return rejected(given.state, play(player, id, payWith(given.state, player, cost, [id])));
};
/** Telekinesis in play on the identity by surgery (no cost, no windows). */
function withKinesis(state: GameState, player: PlayerId = P1) {
  const given = conjure(state, player, "41033");
  const [id] = given.ids as [InstanceId];
  const identity = identityOf(state, player);
  const s = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id) } : p,
    ),
  };
  const withCard = patchInstance(s, id, {
    home: { kind: "player" },
    attachedTo: identity,
    controllerId: player,
    faceup: true,
  });
  return {
    state: patchInstance(withCard, identity, { attachments: [...inst(withCard, identity).attachments, id] }),
    id,
  };
}
const payBoth = (s: GameState, id: InstanceId) => {
  const [k1, k2] = bladesOf(s) as [InstanceId, InstanceId];
  return use(P1, id, KINESIS, [resourceAbility(k1, KNIFE_RESOURCE), resourceAbility(k2, KNIFE_RESOURCE)]);
};

describe("Psylocke pack cards registry", () => {
  it.each(ALL)("%s validates", (id) => {
    expect(validateDefinition(PSYLOCKE_PACK_CARDS[id]!)).toEqual([]);
  });
  it("holds exactly the five refs of 41030-41033 (41032 and 41033 carry no constant: the restriction is data)", () => {
    expect(Object.keys(PSYLOCKE_PACK_CARDS).sort()).toEqual([...ALL].sort());
  });
});

describe("Psi-Bow Attack (41030)", () => {
  it("costs 2: deals 4 damage to the chosen enemy, the event is discarded and Psylocke does not exhaust", () => {
    const { state, arclight } = game();
    const v = stryfe(state);
    const run = playEvent(state, "41030", 2, picking(v));
    expect(damage(run.state, v)).toBe(4);
    expect(damage(run.state, arclight)).toBe(0);
    expect(discardCodes(run.state)).toContain("41030");
    expect(handCodes(run.state)).toHaveLength(handCodes(run.before).length - 1 - 2);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("the attack gains ranged: attacking Arclight (retaliate 1) costs Psylocke no damage", () => {
    const { state, arclight } = game();
    const run = playEvent(state, "41030", 2, picking(arclight));
    expect(damage(run.state, arclight)).toBe(4);
    expect(damage(run.state, identityOf(run.state))).toBe(0);
  });
  it("is a Hero Action: refused in alter-ego form", () => {
    expect(refusedPlay(withForm(game().state, "alterEgo"), "41030", 2)).toBe(true);
  });
  it("needs 2 resources: refused when paid with one card", () => {
    const given = conjure(game().state, P1, "41030");
    const [id] = given.ids as [InstanceId];
    expect(rejected(given.state, play(P1, id, payWith(given.state, P1, 1, [id])))).toBe(true);
  });
  it("another hero qualifies only while PSIONIC: Cable is refused, then plays it with Technovirus Purge won; Spider-Man is refused", () => {
    const { state } = game([CABLE]);
    expect(refusedPlay(state, "41030", 2)).toBe(true);
    const won = withPurgeWon(state);
    expect(refusedPlay(won, "41030", 2)).toBe(false);
    const run = playEvent(won, "41030", 2, picking(stryfe(won)));
    expect(damage(run.state, stryfe(run.state))).toBe(4);
    expect(refusedPlay(game([SPIDER_MAN]).state, "41030", 2)).toBe(true);
  });
  it("two players: Psylocke's seat plays it beside Spider-Man; Spider-Man's seat (first) is refused", () => {
    expect(refusedPlay(game([PSYLOCKE, SPIDER_MAN]).state, "41030", 2)).toBe(false);
    expect(refusedPlay(game([SPIDER_MAN, PSYLOCKE], P2).state, "41030", 2)).toBe(true);
  });
});

describe("Domino (41031)", () => {
  /** Domino in play for P1 (her seat's first hero), ready, with `others` cards left in hand. */
  function inPlay(players: readonly Seat[], seat: PlayerId = P1) {
    const { state, arclight } = game(players, seat);
    const given = conjure(state, seat, "41031");
    const [domino] = given.ids as [InstanceId];
    const played = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(seat, domino, payWith(given.state, seat, 3, [domino])),
    );
    return { state: played.state, domino, arclight };
  }
  const attackWith = (s: GameState, domino: InstanceId, target: InstanceId, seat = P1): Command => ({
    type: "basicAttack",
    playerId: seat,
    attackerInstanceId: domino,
    targetInstanceId: target,
  });

  it("costs 3 and enters play as an ally with 2 ATK / 1 THW / 3 hit points", () => {
    const { state, domino } = inPlay([PSYLOCKE]);
    expect(playerOf(state, P1).playArea).toContain(domino);
    expect(handCodes(state)).not.toContain("41031");
  });
  it("after her basic attack: the chosen hand card goes on top of the deck, the old top card enters the hand, no draw", () => {
    const { state, domino } = inPlay([PSYLOCKE]);
    const hand = playerOf(state, P1).hand[0]!;
    const top = playerOf(state, P1).deck[0]!;
    const deckAfter = playerOf(state, P1).deck.slice(1);
    const run = driveEventsPicking(
      WAVE7_DEPS,
      state,
      accepting(DOMINO, picking(hand, top)),
      attackWith(state, domino, stryfe(state)),
    );
    expect(damage(run.state, stryfe(run.state))).toBe(2);
    expect(playerOf(run.state, P1).deck).toEqual([hand, ...deckAfter]);
    expect(playerOf(run.state, P1).hand).toContain(top);
    expect(playerOf(run.state, P1).hand).not.toContain(hand);
    expect(playerOf(run.state, P1).hand).toHaveLength(playerOf(state, P1).hand.length);
    expect(events(run.events, "cardDrawn")).toEqual([]);
  });
  it("after her basic thwart as well (any of her basic powers)", () => {
    const { state, domino } = inPlay([PSYLOCKE]);
    const scheme = state.mainScheme.instanceId;
    const open = patchInstance({ ...state, villainArea: [] }, scheme, { threat: 6 });
    const hand = playerOf(open, P1).hand[0]!;
    const top = playerOf(open, P1).deck[0]!;
    const run = driveEventsPicking(WAVE7_DEPS, open, accepting(DOMINO, picking(hand, top)), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: domino,
      schemeInstanceId: scheme,
    });
    expect(inst(run.state, scheme).threat).toBe(5);
    expect(playerOf(run.state, P1).deck[0]).toBe(hand);
    expect(playerOf(run.state, P1).hand).toContain(top);
  });
  it("is a response: declined, nothing is swapped", () => {
    const { state, domino } = inPlay([PSYLOCKE]);
    const handBefore = playerOf(state, P1).hand;
    const deckBefore = playerOf(state, P1).deck;
    const run = driveEventsPicking(
      WAVE7_DEPS,
      state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s)),
      attackWith(state, domino, stryfe(state)),
    );
    expect(playerOf(run.state, P1).hand).toEqual(handBefore);
    expect(playerOf(run.state, P1).deck).toEqual(deckBefore);
  });
  it("an empty hand: nothing to swap (RRG 'Swap', p. 42), the hand and deck are unchanged", () => {
    const { state, domino } = inPlay([PSYLOCKE]);
    const bare = { ...state, players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) };
    const deckBefore = playerOf(bare, P1).deck;
    const run = driveEventsPicking(WAVE7_DEPS, bare, accepting(DOMINO), attackWith(bare, domino, stryfe(bare)));
    expect(playerOf(run.state, P1).hand).toEqual([]);
    expect(playerOf(run.state, P1).deck).toEqual(deckBefore);
  });
  it("any identity may use her: Spider-Man's Domino swaps from his own hand and deck", () => {
    const { state, domino } = inPlay([SPIDER_MAN]);
    const hand = playerOf(state, P1).hand[0]!;
    const top = playerOf(state, P1).deck[0]!;
    const run = driveEventsPicking(
      WAVE7_DEPS,
      state,
      accepting(DOMINO, picking(hand, top)),
      attackWith(state, domino, stryfe(state)),
    );
    expect(playerOf(run.state, P1).deck[0]).toBe(hand);
    expect(playerOf(run.state, P1).hand).toContain(top);
  });
  it("two players: only her own basic powers trigger it, and only the controller's hand and deck swap", () => {
    const { state, domino } = inPlay([PSYLOCKE, SPIDER_MAN]);
    // Psylocke's own basic attack is not one of Domino's powers: the response is not offered.
    const own = driveEventsPicking(WAVE7_DEPS, state, accepting(DOMINO), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state, P1),
      targetInstanceId: stryfe(state),
    });
    expect(events(own.events, "abilityResolved").some((e) => e.abilityId === DOMINO)).toBe(false);
    expect(playerOf(own.state, P1).deck).toEqual(playerOf(state, P1).deck);
    // Domino attacks: the controller's hand and deck swap, the other player's do not.
    const hand = playerOf(state, P1).hand[0]!;
    const top = playerOf(state, P1).deck[0]!;
    const run = driveEventsPicking(
      WAVE7_DEPS,
      state,
      accepting(DOMINO, picking(hand, top)),
      attackWith(state, domino, stryfe(state)),
    );
    expect(playerOf(run.state, P1).deck[0]).toBe(hand);
    expect(playerOf(run.state, P1).hand).toContain(top);
    expect(playerOf(run.state, P2).hand).toEqual(playerOf(state, P2).hand);
    expect(playerOf(run.state, P2).deck).toEqual(playerOf(state, P2).deck);
  });
});

describe("Psi-Flail Strike (41032)", () => {
  /**
   * Stryfe's villain-phase attack with the event in the hand of the seat holding it. The boost card is 01186 (blank).
   * `accept`: play the event after the defense.
   */
  function defend(
    players: readonly Seat[],
    seat: PlayerId,
    accept: boolean,
    prep: (s: GameState) => GameState = (s) => s,
  ) {
    const { state: staged, arclight } = game(players, seat);
    const state = prep(staged);
    const given = conjure(state, seat, "41032");
    const base = stackEncounterDeck(given.state, "01186");
    const turns = players.length === 2 ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)];
    const run = driveEventsPicking(
      WAVE7_DEPS,
      base,
      keeping(accept ? accepting(FLAIL) : accepting("none"), "41032"),
      ...turns,
    );
    return { ...run, base, arclight };
  }
  it("baseline: declined, Stryfe takes no damage and is not stunned", () => {
    const run = defend([PSYLOCKE], P1, false);
    expect(damage(run.state, stryfe(run.state))).toBe(0);
    expect(stunned(run.state, stryfe(run.state))).toBe(0);
  });
  it("after Psylocke defends: 3 damage to the attacking enemy and it is stunned; she pays 2 and the event is discarded", () => {
    const run = defend([PSYLOCKE], P1, true);
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(stunned(run.state, stryfe(run.state))).toBe(1);
    expect(discardCodes(run.state)).toContain("41032");
  });
  it("only that enemy takes the damage: the staged Arclight is untouched", () => {
    const run = defend([PSYLOCKE], P1, true);
    expect(damage(run.state, run.arclight)).toBe(0);
  });
  it("it is an attack but not ranged: Psylocke would take Stryfe's retaliate only if he had it, and takes none here", () => {
    // Stryfe has no retaliate keyword, so the only damage she takes is the villain's own attack (2 ATK + the blank boost).
    const run = defend([PSYLOCKE], P1, true);
    const hit = events(run.events, "attackResolved")[0]!;
    expect(damage(run.state, identityOf(run.state))).toBe(hit.damageDealt);
  });
  it("requires an identity with PSIONIC (data): never offered to Spider-Man or Cable, offered to Cable once Purge is won", () => {
    // A Hero Response is only playable in its window, so the restriction is observed there: the event stays in hand.
    const spider = defend([SPIDER_MAN], P1, true);
    expect(damage(spider.state, stryfe(spider.state))).toBe(0);
    expect(handCodes(spider.state)).toContain("41032");
    const cable = defend([CABLE], P1, true);
    expect(damage(cable.state, stryfe(cable.state))).toBe(0);
    expect(handCodes(cable.state)).toContain("41032");
    const won = defend([CABLE], P1, true, withPurgeWon);
    expect(damage(won.state, stryfe(won.state))).toBe(3);
    expect(stunned(won.state, stryfe(won.state))).toBe(1);
  });
  it("two players: Psylocke at seat 2 defends and responds; the defense of seat 1 (Spider-Man) offers it nothing", () => {
    const run = defend([SPIDER_MAN, PSYLOCKE], P2, true);
    // One response only: Stryfe attacked both players, but only Psylocke defended with the event in hand.
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(stunned(run.state, stryfe(run.state))).toBe(1);
    expect(discardCodes(run.state, P2)).toContain("41032");
  });
});

describe("Telekinesis (41033)", () => {
  it("costs 1 and attaches to the identity; Max 1 per player: a second copy is refused", () => {
    const { state } = game();
    const given = conjure(state, P1, "41033");
    const [id] = given.ids as [InstanceId];
    const run = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(P1, id, payWith(given.state, P1, 1, [id]), { attachToInstanceId: identityOf(state) }),
    );
    expect(inst(run.state, identityOf(run.state)).attachments).toContain(id);
    const second = conjure(run.state, P1, "41033");
    const [again] = second.ids as [InstanceId];
    expect(
      rejected(
        second.state,
        play(P1, again, payWith(second.state, P1, 1, [again]), { attachToInstanceId: identityOf(state) }),
      ),
    ).toBe(true);
  });
  it("exhaust it and spend [mental][mental] (two Knives): 3 damage to the chosen enemy", () => {
    const { state: s0, arclight } = game();
    const { state, id } = withKinesis(s0);
    const run = driveEventsPicking(WAVE7_DEPS, state, picking(stryfe(state)), payBoth(state, id));
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(damage(run.state, arclight)).toBe(0);
    expect(inst(run.state, id).exhausted).toBe(true);
    expect(bladesOf(run.state).every((b) => inst(run.state, b).exhausted)).toBe(true);
  });
  it("it is an attack, not ranged: attacking Arclight (retaliate 1) costs Psylocke 1 damage", () => {
    const { state: s0, arclight } = game();
    const { state, id } = withKinesis(s0);
    const run = driveEventsPicking(WAVE7_DEPS, state, picking(arclight), payBoth(state, id));
    expect(damage(run.state, arclight)).toBe(3);
    expect(damage(run.state, identityOf(run.state))).toBe(1);
  });
  it("one [mental] is not enough", () => {
    const { state: s0 } = game();
    const { state, id } = withKinesis(s0);
    const [k1] = bladesOf(state) as [InstanceId];
    expect(rejected(state, use(P1, id, KINESIS, [resourceAbility(k1, KNIFE_RESOURCE)]))).toBe(true);
  });
  it("an exhausted Telekinesis cannot be used again", () => {
    const { state: s0 } = game();
    const { state, id } = withKinesis(s0);
    const tired = patchInstance(state, id, { exhausted: true });
    expect(rejected(tired, payBoth(tired, id))).toBe(true);
  });
  it("is a Hero Action: it may be played in alter-ego form (Betsy is PSIONIC) but cannot be used there", () => {
    const { state: s0 } = game();
    const alter = withForm(s0, "alterEgo");
    const given = conjure(alter, P1, "41033");
    const [id] = given.ids as [InstanceId];
    expect(
      rejected(given.state, play(P1, id, payWith(given.state, P1, 1, [id]), { attachToInstanceId: identityOf(alter) })),
    ).toBe(false);
    const { state, id: attached } = withKinesis(alter);
    expect(rejected(state, payBoth(state, attached))).toBe(true);
  });
  it("requires an identity with PSIONIC (data): Spider-Man and Cable are refused, Cable with Purge won may play it", () => {
    const refusedUpgrade = (st: GameState, p: PlayerId = P1) => {
      const given = conjure(st, p, "41033");
      const [id] = given.ids as [InstanceId];
      return rejected(
        given.state,
        play(p, id, payWith(given.state, p, 1, [id]), { attachToInstanceId: identityOf(st, p) }),
      );
    };
    expect(refusedUpgrade(game([SPIDER_MAN]).state)).toBe(true);
    expect(refusedUpgrade(game([CABLE]).state)).toBe(true);
    expect(refusedUpgrade(withPurgeWon(game([CABLE]).state))).toBe(false);
  });
  it("two players: Psylocke uses it and Spider-Man's hero is untouched; Spider-Man as the first seat is refused", () => {
    const { state: s0 } = game([PSYLOCKE, SPIDER_MAN]);
    const { state, id: kinesis } = withKinesis(s0);
    const run = driveEventsPicking(WAVE7_DEPS, state, picking(stryfe(state)), payBoth(state, kinesis));
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(damage(run.state, identityOf(run.state, P2))).toBe(0);
    const { state: s1 } = game([SPIDER_MAN, PSYLOCKE], P2);
    const given = conjure(s1, P1, "41033");
    const [id] = given.ids as [InstanceId];
    expect(
      rejected(
        given.state,
        play(P1, id, payWith(given.state, P1, 1, [id]), { attachToInstanceId: identityOf(s1, P1) }),
      ),
    ).toBe(true);
  });
});
