import {
  applyCommand,
  createGame,
  maxHitPoints,
  traitsOf,
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
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { ANGEL_PACK_CARDS } from "./pack-cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The angel pack's other cards, docs/phase7-wave7.md §7.2, §3.62: Bombs Away 42029, Eyes in the Sky 42030, Flying
 * Formation 42031 and X-Force Recruit 42032. None is in Angel's starter deck, so each is added to the hand by surgery
 * (`conjure`). His precon (`angel-protection`) against Stryfe through `wave7Scenario`. Angel (`heroForm: 0`) and
 * Archangel (`heroForm: 1`) are AERIAL and X-FORCE, Warren Worthington III is neither, Spider-Man is neither. Stryfe's starting tough status card is removed so an attack is not absorbed.
 * Angel of Life draws 1 and Angel of Death deals the AERIAL event's printed cost: both are exercised against the events.
 */
const BOMBS = "42029.bombs-away-action";
const EYES = "42030.eyes-in-the-sky-interrupt";
const FORMATION = "42031.flying-formation-action";
const RECRUIT = "42032.x-force-recruit-constant";
const LIFE = "42001a.angel-of-life";
const DEATH = "42001c.angel-of-death";
const ALL = [BOMBS, EYES, FORMATION, RECRUIT];

const ANGEL_SEAT = { starterDeckId: "angel-protection" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof ANGEL_SEAT | typeof SPIDER_MAN;

const AERIAL = "AERIAL";
const X_FORCE = "X-FORCE";
const TIGER_SHARK = "01131"; // non-ELITE minion
const WHIRLWIND = "01130"; // non-ELITE minion
const MELTER = "01132"; // non-ELITE minion
const RADIOACTIVE_MAN = "01129"; // ELITE minion
const MAYHEM = "01133"; // Masters of Mayhem, a treachery used as a boost card (its When Revealed never resolves)
const SIDE_SCHEME = "01128"; // The Masters of Evil, a side scheme (not a minion)

const WARREN = "alterEgo" as const;
const ANGEL = { heroForm: 0 } as const;
const ARCHANGEL = { heroForm: 1 } as const;
type Face = typeof WARREN | typeof ANGEL | typeof ARCHANGEL;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const hand = (s: GameState, p: PlayerId = P1): number => playerOf(s, p).hand.length;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const encounterDiscard = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((pile) => pile.discard.map((id) => codeOf(s, id)));
const engagedCodes = (s: GameState, p: PlayerId = P1): string[] =>
  playerOf(s, p)
    .playArea.filter((id) => s.instances[id]!.engagedWith === p)
    .map((id) => codeOf(s, id));
const hp = (s: GameState, id: InstanceId): number => maxHitPoints(s, id, WAVE7_DEPS)!;
const hasTrait = (s: GameState, id: InstanceId, name: string): boolean =>
  traitsOf(s, id, WAVE7_DEPS).some((t) => (t as string) === name);
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The seats with `first` in the given face and every other seat in hero form (so Stryfe's alter-ego game over is not reached). */
function game(face: Face, players: readonly Seat[] = [ANGEL_SEAT], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: ["masters_of_evil"] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  state = face === WARREN ? state : withForm(state, face, P1);
  if (players.length > 1) state = withForm(state, ANGEL, P2);
  const villain = stryfe(state);
  return patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 0 } });
}

let conjured = 9400;
/** A copy of `code` (not in the starter deck) in the player's hand: a clone of a card of that player's own deck. */
function conjure(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...inst(state, owner.deck[0]!),
    instanceId: id,
    cardId: code as never,
    exhausted: false,
    flipped: false,
    attachments: [],
    attachedTo: null,
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}
/** An ally of `code` in the player's play area by surgery (exhausted when asked). */
function withAlly(state: GameState, player: PlayerId, code: string, exhausted = false) {
  const owner = playerOf(state, player);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...inst(state, owner.deck[0]!),
    instanceId: id,
    cardId: code as never,
    home: { kind: "playArea", playerId: player },
    exhausted,
    attachments: [],
    attachedTo: null,
  } as never;
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
  };
}
const exhausted = (s: GameState, id: InstanceId, on = true): GameState => patchInstance(s, id, { exhausted: on });

/** Picks `ids` where a prompt offers them (a player, characters); everything else as `firstLegal`. */
const choosing =
  (...ids: readonly string[]): Picker =>
  (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    const hits = ids.filter((id) => offered.includes(id));
    return hits.length > 0 ? hits : firstLegal(s);
  };
/** Accepts the response or interrupt of this ability when offered (others declined); other prompts as `inner`. */
const accepting =
  (ability: string, inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(ability));
      return hit ? [hit.optionId] : [];
    }
    return inner(s);
  };

/** Plays the conjured `code` for `cost` from `player`'s hand, logging every trigger offered. */
function playCard(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
  attach?: InstanceId,
  costChoices?: Readonly<Record<string, readonly InstanceId[]>>,
) {
  const given = conjure(state, player, code);
  const offered: string[] = [];
  const logging: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") for (const o of choice.options) offered.push(o.optionId);
    return pick(s);
  };
  const command = play(player, given.id, payWith(given.state, player, cost, [given.id]), {
    ...(attach ? { attachToInstanceId: attach } : {}),
    ...(costChoices ? { costChoices } : {}),
  });
  const run = driveEventsPicking(WAVE7_DEPS, given.state, logging, command);
  return { ...run, id: given.id, offered, before: given.state };
}
const playable = (
  state: GameState,
  code: string,
  cost: number,
  player: PlayerId = P1,
  attach?: InstanceId,
): boolean => {
  const given = conjure(state, player, code);
  const command: Command = play(player, given.id, payWith(given.state, player, cost, [given.id]), {
    ...(attach ? { attachToInstanceId: attach } : {}),
  });
  return applyCommand(given.state, command, WAVE7_DEPS).ok;
};
const offeredId = (offered: readonly string[], ref: string) => offered.some((o) => o.includes(ref));

describe("Angel pack cards registry", () => {
  it.each(ALL)("%s validates", (id) => {
    expect(validateDefinition(ANGEL_PACK_CARDS[id]!)).toEqual([]);
  });
  it("holds exactly the four refs", () => {
    expect(Object.keys(ANGEL_PACK_CARDS).sort()).toEqual([...ALL].sort());
  });
});

describe("Bombs Away (42029)", () => {
  /** A minion engaged with P1 on top of the villain. */
  const withShark = (s: GameState, p: PlayerId = P1) => engageMinion(s, TIGER_SHARK, p);

  it("as Angel, costs 2: exhausts the hero, 3 damage to the villain and 3 to the minion engaged with you", () => {
    const shark = withShark(game(ANGEL));
    const run = playCard(shark.state, "42029", 2);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    expect(damageOn(run.state, stryfe(shark.state))).toBe(3);
    expect(damageOn(run.state, shark.id)).toBe(3);
    expect(hand(run.state)).toBe(hand(run.before) - 3); // the event and its two payment cards
    expect(discardCodes(run.state)).toContain("42029");
  });
  it("is plain damage, not an attack: Tiger Shark is not stunned and the hero takes no retaliation", () => {
    const shark = withShark(game(ARCHANGEL));
    const run = playCard(shark.state, "42029", 2);
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
    expect(inst(run.state, shark.id).statuses.stunned ?? 0).toBe(0);
    expect(events(run.events, "damageDealt").filter((e) => e.targetInstanceId === shark.id)).toHaveLength(1);
  });
  it("an exhausted AERIAL character cannot pay: refused with the hero exhausted, allowed with a ready one", () => {
    const base = game(ANGEL);
    expect(playable(exhausted(base, identityOf(base)), "42029", 2)).toBe(false);
    expect(playable(base, "42029", 2)).toBe(true);
  });
  it("a Hero Action: refused as Warren Worthington III, who is not AERIAL either", () => {
    const base = game(WARREN, [ANGEL_SEAT, SPIDER_MAN]);
    expect(playable(base, "42029", 2)).toBe(false);
  });
  it("an AERIAL ally pays instead, and the hero stays ready", () => {
    const base = game(ANGEL);
    const siryn = withAlly(base, P1, "42012");
    const run = playCard(siryn.state, "42029", 2, firstLegal, P1, undefined, { exhausted: [siryn.id] });
    expect(hasTrait(run.state, siryn.id, AERIAL)).toBe(true);
    expect(inst(run.state, siryn.id).exhausted).toBe(true);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(damageOn(run.state, stryfe(base))).toBe(3);
  });
  it("two players: only the chosen player's engaged minions take 3; the other player's minion is untouched", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const mine = withShark(base, P1);
    const theirs = engageMinion(mine.state, WHIRLWIND, P2);
    const run = playCard(theirs.state, "42029", 2, choosing("p2"));
    expect(damageOn(run.state, theirs.id)).toBe(3);
    expect(damageOn(run.state, mine.id)).toBe(0);
    expect(damageOn(run.state, stryfe(base))).toBe(3);
  });
  it("two players: only the AERIAL characters you control count (Spider-Man's player cannot pay with Angel)", () => {
    const base = game(ANGEL, [SPIDER_MAN, ANGEL_SEAT]);
    // P1's seat is Spider-Man (hero form 0 below); P2 is Angel. P1 controls no AERIAL character.
    const asSpider = withForm(base, ANGEL, P1);
    expect(hasTrait(asSpider, identityOf(asSpider, P1), AERIAL)).toBe(false);
    expect(hasTrait(asSpider, identityOf(asSpider, P2), AERIAL)).toBe(true);
    expect(playable(asSpider, "42029", 2, P1)).toBe(false);
  });
  it("Angel of Life draws 1 after the AERIAL event is played; Angel of Death deals its printed cost, 2, to the villain", () => {
    const life = playCard(game(ANGEL), "42029", 2, accepting(LIFE));
    expect(offeredId(life.offered, LIFE)).toBe(true);
    expect(hand(life.state)).toBe(hand(life.before) - 3 + 1);
    const death = playCard(game(ARCHANGEL), "42029", 2, accepting(DEATH));
    expect(offeredId(death.offered, DEATH)).toBe(true);
    expect(damageOn(death.state, stryfe(death.state))).toBe(3 + 2);
  });
});

describe("Eyes in the Sky (42030)", () => {
  const PICK_EYES = accepting(EYES);
  /** Every optional trigger declined; other prompts as `firstLegal`. */
  const declining: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s));
  /** Eyes in the Sky played onto the seat's identity (cost 0), then the villain phase with a stunned Stryfe and these encounter cards on top. */
  function villainPhase(base: GameState, pick: Picker, ...encounter: readonly string[]) {
    const played = playCard(base, "42030", 0, firstLegal);
    const eyes = played.id;
    // A stunned Stryfe skips one attack: with a second seat his activation against it deals a boost card first.
    const boost = base.players.length > 1 ? [MAYHEM] : [];
    const quiet = patchInstance(stackEncounterDeck(played.state, ...boost, ...encounter), stryfe(base), {
      statuses: { ...inst(base, stryfe(base)).statuses, stunned: 1, tough: 0 },
    });
    const offered: string[] = [];
    const logging: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") for (const o of choice.options) offered.push(o.optionId);
      return pick(s);
    };
    const run = driveEventsPicking(WAVE7_DEPS, quiet, logging, ...quiet.players.map((pl) => endTurn(pl.playerId)));
    return { ...run, eyes, offered, before: quiet };
  }

  it("costs 0 and attaches to the identity", () => {
    const run = playCard(game(ANGEL), "42030", 0);
    expect(inst(run.state, run.id).attachedTo).toBe(identityOf(run.state));
    expect(hand(run.state)).toBe(hand(run.before) - 1);
  });
  it("accepted on a non-ELITE minion: it is cancelled and discarded, another card is revealed, Eyes in the Sky is discarded, the hero is exhausted", () => {
    const run = villainPhase(game(ANGEL), PICK_EYES, TIGER_SHARK, WHIRLWIND);
    expect(offeredId(run.offered, EYES)).toBe(true);
    expect(encounterDiscard(run.state)).toContain(TIGER_SHARK);
    expect(engagedCodes(run.state)).toEqual([WHIRLWIND]);
    expect(discardCodes(run.state)).toContain("42030");
    expect(inst(run.state, identityOf(run.state)).attachments).not.toContain(run.eyes);
    expect(events(run.events, "revealCancelled")).toHaveLength(1);
    // The hero exhausted to pay, then readied at the end of the villain phase's round: only the payment is asserted.
    expect(events(run.events, "cardExhausted").some((e) => e.instanceId === identityOf(run.state))).toBe(true);
  });
  it("declined: the minion is revealed and engages, Eyes in the Sky stays attached", () => {
    const run = villainPhase(game(ANGEL), declining, TIGER_SHARK, WHIRLWIND);
    expect(engagedCodes(run.state)).toEqual([TIGER_SHARK]);
    expect(inst(run.state, identityOf(run.state)).attachments).toContain(run.eyes);
  });
  it("an ELITE minion cannot be answered: Radioactive Man is not offered", () => {
    const run = villainPhase(game(ANGEL), PICK_EYES, RADIOACTIVE_MAN, WHIRLWIND);
    expect(offeredId(run.offered, EYES)).toBe(false);
    expect(engagedCodes(run.state)).toEqual([RADIOACTIVE_MAN]);
  });
  it("only a minion: a revealed card that is not a minion is not offered", () => {
    const run = villainPhase(game(ANGEL), PICK_EYES, SIDE_SCHEME, WHIRLWIND);
    expect(offeredId(run.offered, EYES)).toBe(false);
  });
  it("an AERIAL ally can be the one exhausted, the hero stays ready", () => {
    const base = game(ANGEL);
    const siryn = withAlly(base, P1, "42012");
    const run = villainPhase(siryn.state, choosingTriggerThen(EYES, siryn.id), TIGER_SHARK, WHIRLWIND);
    expect(encounterDiscard(run.state)).toContain(TIGER_SHARK);
    const exhaustedIds = events(run.events, "cardExhausted").map((e) => e.instanceId);
    expect(exhaustedIds).toContain(siryn.id);
    expect(exhaustedIds).not.toContain(identityOf(run.state));
  });
  it("a Hero Interrupt: as Warren Worthington III it is not offered", () => {
    const base = game(WARREN, [ANGEL_SEAT, SPIDER_MAN]);
    const run = villainPhase(base, PICK_EYES, TIGER_SHARK, WHIRLWIND);
    expect(offeredId(run.offered, EYES)).toBe(false);
    expect(engagedCodes(run.state)).toContain(TIGER_SHARK);
  });
  it("two players: another player's reveal does not offer it, only the controller's", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    // P1 reveals the side scheme (not a minion), P2 reveals the Tiger Shark.
    const run = villainPhase(base, PICK_EYES, SIDE_SCHEME, TIGER_SHARK);
    expect(offeredId(run.offered, EYES)).toBe(false);
    expect(engagedCodes(run.state, P2)).toContain(TIGER_SHARK);
  });
  it("two players: when its controller reveals the minion it is cancelled and the controller reveals the next card", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const run = villainPhase(base, PICK_EYES, TIGER_SHARK, WHIRLWIND, MELTER);
    expect(encounterDiscard(run.state)).toContain(TIGER_SHARK);
    // Each player is dealt a card first, so P2 holds the Whirlwind and the replacement is the next card down, the Melter.
    expect(engagedCodes(run.state, P1)).toEqual([MELTER]);
    expect(engagedCodes(run.state, P2)).toEqual([WHIRLWIND]);
  });
});

/** Accepts `ability`'s trigger and answers a cost pick with `id`; everything else as `firstLegal`. */
function choosingTriggerThen(ability: string, id: InstanceId): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(ability));
      return hit ? [hit.optionId] : [];
    }
    return choosing(id)(s);
  };
}

describe("Flying Formation (42031)", () => {
  /** Angel, Siryn, Warpath and Cannonball (AERIAL allies) all exhausted, with Spider-Man's player at the second seat. */
  function exhaustedTeam() {
    let s = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const siryn = withAlly(s, P1, "42012", true);
    const warpath = withAlly(siryn.state, P1, "42013", true);
    const cannonball = withAlly(warpath.state, P1, "42020", true);
    s = exhausted(cannonball.state, identityOf(cannonball.state));
    return { state: s, hero: identityOf(s), siryn: siryn.id, warpath: warpath.id, cannonball: cannonball.id };
  }
  const readyOf = (s: GameState, id: InstanceId) => !inst(s, id).exhausted;

  it("costs 4 and readies the chosen AERIAL characters (up to 3): the hero and Siryn", () => {
    const t = exhaustedTeam();
    for (const id of [t.siryn, t.warpath, t.cannonball]) expect(hasTrait(t.state, id, AERIAL)).toBe(true);
    const run = playCard(t.state, "42031", 4, choosing(t.hero, t.siryn));
    expect(readyOf(run.state, t.hero)).toBe(true);
    expect(readyOf(run.state, t.siryn)).toBe(true);
    expect(readyOf(run.state, t.warpath)).toBe(false);
    expect(readyOf(run.state, t.cannonball)).toBe(false);
    expect(hand(run.state)).toBe(hand(run.before) - 5);
    expect(discardCodes(run.state)).toContain("42031");
  });
  it("at most 3: with four exhausted AERIAL characters to choose from, the prompt takes 1 to 3 and the three picked are readied", () => {
    const t = exhaustedTeam();
    let max = 0;
    let offered = 0;
    const run = playCard(t.state, "42031", 4, (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget") {
        max = choice.maxSelections;
        offered = choice.options.length;
        return [t.hero, t.siryn, t.cannonball];
      }
      return firstLegal(s);
    });
    expect([max, offered]).toEqual([3, 4]);
    expect([t.hero, t.siryn, t.warpath, t.cannonball].filter((id) => readyOf(run.state, id))).toEqual([
      t.hero,
      t.siryn,
      t.cannonball,
    ]);
  });
  it("only AERIAL characters: Spider-Man's exhausted hero is not offered and stays exhausted", () => {
    const t = exhaustedTeam();
    const spider = identityOf(t.state, P2);
    const tired = exhausted(t.state, spider);
    const run = playCard(tired, "42031", 4, (s) => {
      expect(s.pendingChoice?.options.map((o) => o.optionId) ?? []).not.toContain(spider);
      return choosing(t.hero)(s);
    });
    expect(readyOf(run.state, spider)).toBe(false);
  });
  it("is an Alliance card: the second player pays part of its cost", () => {
    const t = exhaustedTeam();
    const given = conjure(t.state, P1, "42031");
    const mine = payWith(given.state, P1, 2, [given.id]);
    const theirs = payWith(given.state, P2, 2);
    const command = play(P1, given.id, [...mine, ...theirs]);
    const run = driveEventsPicking(WAVE7_DEPS, given.state, choosing(t.hero), command);
    expect(readyOf(run.state, t.hero)).toBe(true);
    expect(hand(run.state, P2)).toBe(hand(given.state, P2) - 2);
  });
  it("another player's AERIAL ally can be readied too (Siryn under Spider-Man's player)", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const theirs = withAlly(base, P2, "42012", true);
    const run = playCard(theirs.state, "42031", 4, choosing(theirs.id));
    expect(readyOf(run.state, theirs.id)).toBe(true);
  });
  it("a Hero Action: refused as Warren Worthington III", () => {
    expect(playable(game(WARREN, [ANGEL_SEAT, SPIDER_MAN]), "42031", 4)).toBe(false);
  });
  it("Angel of Life draws 1 and Angel of Death deals its printed cost, 4, to the villain", () => {
    const life = playCard(exhaustedTeam().state, "42031", 4, accepting(LIFE, choosing()));
    expect(offeredId(life.offered, LIFE)).toBe(true);
    expect(hand(life.state)).toBe(hand(life.before) - 5 + 1);
    const base = withForm(game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]), ARCHANGEL, P1);
    const death = playCard(base, "42031", 4, accepting(DEATH));
    expect(offeredId(death.offered, DEATH)).toBe(true);
    expect(damageOn(death.state, stryfe(base))).toBe(4);
  });
});

describe("X-Force Recruit (42032)", () => {
  it("costs 0: attached to the hero it gives +1 hit point (the hero already has X-FORCE)", () => {
    const base = game(ANGEL);
    const hero = identityOf(base);
    const run = playCard(base, "42032", 0, firstLegal, P1, hero);
    expect(inst(run.state, run.id).attachedTo).toBe(hero);
    expect(hp(run.state, hero)).toBe(hp(base, hero) + 1);
    expect(hand(run.state)).toBe(hand(run.before) - 1);
  });
  it("attached to an ally (Siryn) it gives +1 hit point and the ally gains X-FORCE if it lacked it", () => {
    const base = game(ANGEL);
    const ally = withAlly(base, P1, "42012");
    const run = playCard(ally.state, "42032", 0, firstLegal, P1, ally.id);
    expect(hasTrait(run.state, ally.id, X_FORCE)).toBe(true);
    expect(hp(run.state, ally.id)).toBe(hp(ally.state, ally.id) + 1);
  });
  it("play only if your identity has the X-FORCE trait: Angel and Archangel yes, Warren Worthington III no", () => {
    for (const face of [ANGEL, ARCHANGEL]) {
      const s = game(face);
      expect(playable(s, "42032", 0, P1, identityOf(s))).toBe(true);
    }
    const warren = game(WARREN, [ANGEL_SEAT, SPIDER_MAN]);
    expect(playable(warren, "42032", 0, P1, identityOf(warren))).toBe(false);
  });
  it("another player's identity: Spider-Man (no X-FORCE) is refused, a second Angel-side seat (X-FORCE) is allowed", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    expect(hasTrait(base, identityOf(base, P2), X_FORCE)).toBe(false);
    const asSpider = withForm(base, ANGEL, P1);
    // P2 (Spider-Man) holds the card: his identity lacks X-FORCE, so he cannot play it onto any character.
    expect(playable(asSpider, "42032", 0, P2, identityOf(asSpider, P2))).toBe(false);
    // P1 (Angel) may attach it to Spider-Man's hero: the restriction reads the player's own identity.
    expect(playable(asSpider, "42032", 0, P1, identityOf(asSpider, P2))).toBe(true);
  });
  it("attached to another player's character it grants +1 hit point and X-FORCE to that character", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const spider = identityOf(base, P2);
    const run = playCard(base, "42032", 0, firstLegal, P1, spider);
    expect(hasTrait(run.state, spider, X_FORCE)).toBe(true);
    expect(hp(run.state, spider)).toBe(hp(base, spider) + 1);
  });
  it("max 1 per character: a second copy on the same character is refused, on another character it is allowed", () => {
    const base = game(ANGEL);
    const hero = identityOf(base);
    const siryn = withAlly(base, P1, "42012");
    const first = playCard(siryn.state, "42032", 0, firstLegal, P1, hero);
    expect(playable(first.state, "42032", 0, P1, hero)).toBe(false);
    expect(playable(first.state, "42032", 0, P1, siryn.id)).toBe(true);
  });
  it("leaving play ends it: with the upgrade discarded the hit points and trait are the printed ones", () => {
    const base = game(ANGEL);
    const siryn = withAlly(base, P1, "42012");
    const run = playCard(siryn.state, "42032", 0, firstLegal, P1, siryn.id);
    const gone = {
      ...run.state,
      instances: { ...run.state.instances, [siryn.id]: { ...inst(run.state, siryn.id), attachments: [] } },
    } as GameState;
    expect(hp(gone, siryn.id)).toBe(hp(siryn.state, siryn.id));
  });
});
