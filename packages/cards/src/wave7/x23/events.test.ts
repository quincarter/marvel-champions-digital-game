import { cardId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  endTurn,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { ANT_PACK_CARDS } from "../../wave2/ant/pack-cards.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { X23_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * X-23's events (43004-43006) and the pack's other events (43016, 43017, 43038, 43040), docs/phase7-wave7.md §7.3, on
 * her precon (`x-23-aggression`) against Stryfe through `wave7Scenario`. Sisterly Bond (43007) is not scripted (see
 * `events.ts` and `coverage.test.ts`), so the card is only used here as a Laura Kinney Action target elsewhere.
 *
 * Costs of events played in response to something are paid through the `payForCard` prompt (`pay`).
 */
const ANIMAL_INSTINCT = "43004.animal-instinct-interrupt";
const SISTERLY_BOND = "43007.sisterly-bond-interrupt";
const CLAW_MASTERY = "43005.claw-mastery-action";
const LONGEVITY = "43006.regenerative-longevity-action";
const CRITICAL_HIT_PLAY = "43016.critical-hit-constant";
const CRITICAL_HIT = "43016.critical-hit-response";
const TRIUMPH = "43017.moment-of-triumph-response";
const PLOY_PLAY = "43038.predictable-ploy-constant";
const PLOY = "43038.predictable-ploy-interrupt";
const ATTACK_PLAY = "43040.anticipated-attack-constant";
const ANTICIPATED_ATTACK = "43040.anticipated-attack-interrupt";
const ALL_REFS = [
  ANIMAL_INSTINCT,
  SISTERLY_BOND,
  CLAW_MASTERY,
  LONGEVITY,
  CRITICAL_HIT_PLAY,
  CRITICAL_HIT,
  TRIUMPH,
  PLOY_PLAY,
  PLOY,
  ATTACK_PLAY,
  ANTICIPATED_ATTACK,
];
const LIVING_WEAPON = "43001a.living-weapon";

const X23 = { starterDeckId: "x-23-aggression" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof X23 | typeof SPIDER_MAN;

const HONEY_BADGER = "43003"; // ally, cost 2, ATK 1, THW 1, 2 hit points
const MERCENARY = "01101"; // Hydra Mercenary: ATK 1, 3 hit points, Guard
const ADVANCE = "01186"; // treachery: "When Revealed: The villain schemes."
const CAPTIVE_HOPE = "40131"; // an encounter side scheme, staged into the victory display

const DEPS = WAVE7_DEPS;
function setupGame(players: readonly Seat[] = [X23], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (players?: readonly Seat[], seed = 1, player = P1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 }, player);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, DEPS).ok;

const basicAttack = (s: GameState, target: InstanceId, who = identityOf(s), p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who,
  targetInstanceId: target,
});
const basicThwart = (s: GameState, scheme: InstanceId, who = identityOf(s), p: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who,
  schemeInstanceId: scheme,
});

/** Stryfe's setup leaves a crisis-icon side scheme that blocks threat removal from the main scheme. */
const withoutSideSchemes = (s: GameState, mainThreat = 10): GameState =>
  patchInstance({ ...s, villainArea: [] }, mainOf(s), { threat: mainThreat });

/** A card not in the deck, added to `player`'s hand. */
function injectIntoHand(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const id = `synthetic-${code}-${player}` as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: player,
    controllerId: player,
    home: { kind: "player" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
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
/** `code` in `player`'s hand: the deck's own copy when it has one, else a synthetic one (43038, 43040 are not in her deck). */
function given(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const has = [...owner.hand, ...owner.deck, ...owner.discard].some((id) => codeOf(state, id) === code);
  if (!has) return injectIntoHand(state, player, code);
  const moved = moveToHand(state, player, code);
  return { state: moved.state, id: moved.ids[0]! };
}

/** A minion by surgery, engaged with `player`, in their play area. */
function withMinion(
  state: GameState,
  code: string,
  opts: { player?: PlayerId; damage?: number } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: opts.damage ?? 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}

/** An encounter side scheme moved into the victory display (surgery). */
function withSideSchemeInVictory(state: GameState): GameState {
  const staged = encounterCardInVillainArea(state, CAPTIVE_HOPE, 0);
  return {
    ...staged.state,
    villainArea: staged.state.villainArea.filter((x) => x !== staged.id),
    victoryDisplay: [...staged.state.victoryDisplay, staged.id],
  };
}

const COSTS: Readonly<Record<string, number>> = { "43016": 2, "43038": 2, "43040": 2 };
/** Pays an event's cost out of the hand through the `payForCard` prompt; accepts `ref` when it is offered. */
function accepting(
  ref: string,
  log: { offered: number } = { offered: 0 },
  answers: { skip?: number; cost?: number } = {},
): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard")
      return choice.options.slice(0, answers.cost ?? COSTS[ref.slice(0, 5)] ?? 0).map((o) => o.optionId);
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(ref));
      if (hit) {
        log.offered += 1;
        if (answers.skip && log.offered <= answers.skip) return [];
        return [hit.optionId];
      }
      const lw = choice.options.find((o) => o.optionId.includes(LIVING_WEAPON));
      return lw ? [] : firstLegal(s);
    }
    return firstLegal(s);
  };
}
/** Accepts Living Weapon when offered (counting it), declines other optional triggers. */
function acceptingLivingWeapon(log: { offered: number }): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(LIVING_WEAPON));
      if (hit) log.offered += 1;
      return hit ? [hit.optionId] : [];
    }
    return firstLegal(s);
  };
}

/** Plays `code` from hand paying `cost` with other hand cards, answering prompts with `pick`. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker = firstLegal, player: PlayerId = P1) {
  const g = given(state, code, player);
  const driven = driveEventsPicking(DEPS, g.state, pick, play(player, g.id, payWith(g.state, player, cost, [g.id])));
  return { state: driven.state, id: g.id, before: g.state, events: driven.events };
}
const playRefused = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const g = given(state, code, player);
  return rejected(g.state, play(player, g.id, payWith(g.state, player, cost, [g.id])));
};
/** Honey Badger played from hand for 2 (hero form). */
const withHoneyBadger = (state: GameState): { state: GameState; id: InstanceId } => {
  const r = playEvent(state, HONEY_BADGER, 2);
  return { state: r.state, id: r.id };
};
const hurt = (s: GameState, id: InstanceId, damage: number): GameState => patchInstance(s, id, { damage });
/** Every player's turn ended in order: the villain phase follows. */
const endTurns = (players: number): Command[] => (players === 2 ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)]);
const turnOfP2 = (state: GameState): GameState =>
  withForm(driveEventsPicking(DEPS, state, firstLegal, endTurn(P1)).state, { heroForm: 0 }, P2);

describe("X-23 events registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(X23_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly its eleven refs: every ref of the eight events", () => {
    expect(Object.keys(X23_EVENTS).sort()).toEqual([...ALL_REFS].sort());
  });
  it("Moment of Triumph is the Core reprint's definition (12030), the same object", () => {
    expect(X23_EVENTS[TRIUMPH]).toBe(ANT_PACK_CARDS["12030.moment-of-triumph-response"]);
  });
});

describe("Animal Instinct (43004): Hero Interrupt, +X THW on her basic thwart, X her ATK", () => {
  const thwarted = (state: GameState, pick: Picker, thwarter = identityOf(state)) => {
    const s = withoutSideSchemes(state);
    const before = s.instances[mainOf(s)]!.threat;
    const r = driveEventsPicking(DEPS, s, pick, basicThwart(s, mainOf(s), thwarter));
    return { removed: before - inst(r.state, mainOf(r.state)).threat, state: r.state };
  };
  it("without it her basic thwart removes her THW, 2", () => {
    expect(thwarted(heroGame(), firstLegal).removed).toBe(2);
  });
  it("costs 0: her THW 2 + her ATK 1 = 3 threat removed, and the event is discarded", () => {
    const g = given(heroGame(), "43004");
    const r = thwarted(g.state, accepting(ANIMAL_INSTINCT));
    expect(r.removed).toBe(3);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(g.state, P1).hand.length - 1);
  });
  it("is optional: declined, she removes only 2 and the card stays in hand", () => {
    const g = given(heroGame(), "43004");
    const r = thwarted(g.state, firstLegal);
    expect(r.removed).toBe(2);
    expect(playerOf(r.state, P1).hand).toContain(g.id);
  });
  it("X is her ATK as it is now: with Claw Mastery's +2 ATK (3), the thwart is 2 + 3 = 5", () => {
    const boosted = playEvent(heroGame(), "43005", 1).state;
    expect(profile(boosted, identityOf(boosted)).atk).toBe(3);
    const g = given(boosted, "43004");
    expect(thwarted(g.state, accepting(ANIMAL_INSTINCT)).removed).toBe(5);
  });
  it("the bonus is for that thwart only: the next thwart (after she readies) is back to 2", () => {
    const g = given(heroGame(), "43004");
    const first = thwarted(g.state, accepting(ANIMAL_INSTINCT));
    expect(first.removed).toBe(3);
    const ready = patchInstance(first.state, identityOf(first.state), { exhausted: false });
    const second = driveEventsPicking(DEPS, ready, firstLegal, basicThwart(ready, mainOf(ready)));
    expect(inst(ready, mainOf(ready)).threat - inst(second.state, mainOf(second.state)).threat).toBe(2);
  });
  it("is not offered on her basic attack (a thwart only)", () => {
    const g = given(heroGame(), "43004");
    const log = { offered: 0 };
    driveEventsPicking(DEPS, g.state, accepting(ANIMAL_INSTINCT, log), basicAttack(g.state, villainOf(g.state)));
    expect(log.offered).toBe(0);
  });
  it("is not offered on Honey Badger's thwart: it is X-23's own basic thwart", () => {
    const hb = withHoneyBadger(heroGame());
    const g = given(hb.state, "43004");
    const log = { offered: 0 };
    const s = withoutSideSchemes(g.state);
    const r = driveEventsPicking(DEPS, s, accepting(ANIMAL_INSTINCT, log), basicThwart(s, mainOf(s), hb.id));
    expect(log.offered).toBe(0);
    expect(inst(s, mainOf(s)).threat - inst(r.state, mainOf(r.state)).threat).toBe(1);
  });
  it("two players: not offered on Spider-Man's thwart; it is X-23's player's own", () => {
    const base = withoutSideSchemes(heroGame([X23, SPIDER_MAN]));
    const g = given(base, "43004");
    const p2 = turnOfP2(g.state);
    const log = { offered: 0 };
    const main = mainOf(p2);
    const r = driveEventsPicking(
      DEPS,
      patchInstance(p2, main, { threat: 10 }),
      accepting(ANIMAL_INSTINCT, log),
      basicThwart(p2, main, identityOf(p2, P2), P2),
    );
    expect(log.offered).toBe(0);
    expect(playerOf(r.state, P1).hand).toContain(g.id);
  });
});

describe("Claw Mastery (43005): Hero Action, +2 ATK this round, overkill while Honey Badger is in play", () => {
  /** A Mercenary with 1 hit point left (damage 2 of 3), so a 3-ATK attack has 2 excess. */
  const attackOnWounded = (state: GameState) => {
    const m = withMinion(state, MERCENARY, { damage: 2 });
    const r = driveEventsPicking(DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    return { state: r.state, villainDamage: damageOn(r.state, villainOf(r.state)), minion: m.id };
  };
  it("costs 1: her ATK goes from 1 to 3 and the event is discarded", () => {
    const base = heroGame();
    expect(profile(base, identityOf(base)).atk).toBe(1);
    const r = playEvent(base, "43005", 1);
    expect(profile(r.state, identityOf(r.state)).atk).toBe(3);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(r.before, P1).hand.length - 2);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("her basic attack deals 3 to the villain with the bonus (1 without)", () => {
    const base = heroGame();
    const without = driveEventsPicking(DEPS, base, firstLegal, basicAttack(base, villainOf(base)));
    expect(damageOn(without.state, villainOf(without.state))).toBe(damageOn(base, villainOf(base)) + 1);
    const boosted = playEvent(base, "43005", 1).state;
    const r = driveEventsPicking(DEPS, boosted, firstLegal, basicAttack(boosted, villainOf(boosted)));
    expect(damageOn(r.state, villainOf(r.state))).toBe(damageOn(base, villainOf(base)) + 3);
  });
  it("with Honey Badger in play her attacks gain overkill: 3 ATK on a 1-hit-point minion spills 2 to the villain", () => {
    const hb = withHoneyBadger(heroGame());
    const boosted = playEvent(hb.state, "43005", 1).state;
    const r = attackOnWounded(boosted);
    expect(damageOn(r.state, r.minion)).toBe(0);
    expect(r.villainDamage).toBe(damageOn(boosted, villainOf(boosted)) + 2);
  });
  it("without Honey Badger there is no overkill: the 2 excess damage is lost", () => {
    const boosted = playEvent(heroGame(), "43005", 1).state;
    const r = attackOnWounded(boosted);
    expect(r.villainDamage).toBe(damageOn(boosted, villainOf(boosted)));
  });
  it("Honey Badger is read when she attacks: played after Claw Mastery, the overkill applies", () => {
    const boosted = playEvent(heroGame(), "43005", 1).state;
    const hb = withHoneyBadger(boosted);
    const r = attackOnWounded(hb.state);
    expect(r.villainDamage).toBe(damageOn(hb.state, villainOf(hb.state)) + 2);
  });
  it("and it stops when she leaves play: Honey Badger discarded after Claw Mastery, no overkill", () => {
    const hb = withHoneyBadger(heroGame());
    const boosted = playEvent(hb.state, "43005", 1).state;
    const gone = {
      ...boosted,
      players: boosted.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((x) => x !== hb.id), discard: [...p.discard, hb.id] }
          : p,
      ),
    };
    expect(attackOnWounded(gone).villainDamage).toBe(damageOn(gone, villainOf(gone)));
  });
  it("Max 1 per round: a second copy is refused the same round", () => {
    const one = playEvent(heroGame(), "43005", 1).state;
    expect(playRefused(one, "43005", 1)).toBe(true);
  });
  it("lasts until the end of the round: ATK is 1 again in the next round, and the card is playable again", () => {
    const one = playEvent(heroGame(), "43005", 1).state;
    const round = one.round;
    const next = settle(
      driveEventsPicking(DEPS, one, firstLegal, endTurn(P1)).state,
      firstLegal,
      (s) => s.step.phase === "player" && s.round > round,
      DEPS,
    );
    expect(profile(next, identityOf(next)).atk).toBe(1);
    expect(playRefused(withForm(next, { heroForm: 0 }, P1), "43005", 1)).toBe(false);
  });
  it("is a Hero Action: refused in alter-ego form", () => {
    const g = given(setupGame(), "43005");
    expect(rejected(g.state, play(P1, g.id, payWith(g.state, P1, 1, [g.id])))).toBe(true);
  });
  it("two players: only X-23 gets it; Spider-Man's ATK is unchanged", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const before = profile(base, identityOf(base, P2)).atk;
    const r = playEvent(base, "43005", 1);
    expect(profile(r.state, identityOf(r.state, P2)).atk).toBe(before);
    expect(profile(r.state, identityOf(r.state, P1)).atk).toBe(3);
  });
});

describe("Regenerative Longevity (43006): Action, heal a total of 4 from your identity and Honey Badger", () => {
  /** Answers the divide prompt with `shares` (option ids built from the instance and an ordinal). */
  const dividing =
    (shares: (offered: readonly string[]) => readonly string[], asked: { options?: readonly string[] } = {}): Picker =>
    (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind !== "divide") return firstLegal(s);
      asked.options = c.options.map((o) => o.optionId);
      return shares(asked.options);
    };
  const ofCard = (options: readonly string[], id: InstanceId, n: number): string[] =>
    options.filter((o) => o.startsWith(`${id}#`)).slice(0, n);
  it("costs 1: all 4 to the identity when she is the only one hurt (no choice asked)", () => {
    const base = hurt(heroGame(), identityOf(heroGame()), 6);
    const asked: { options?: readonly string[] } = {};
    const r = playEvent(
      base,
      "43006",
      1,
      dividing(() => [], asked),
    );
    expect(damageOn(r.state, identityOf(r.state))).toBe(2);
    expect(asked.options).toBeUndefined();
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("splits as chosen: 5 on X-23 and 1 on Honey Badger; 3 to her and 1 to Honey Badger leaves 2 and 0", () => {
    const hb = withHoneyBadger(heroGame());
    const base = hurt(hurt(hb.state, identityOf(hb.state), 5), hb.id, 1);
    const asked: { options?: readonly string[] } = {};
    const r = playEvent(
      base,
      "43006",
      1,
      dividing((o) => [...ofCard(o, identityOf(base), 3), ...ofCard(o, hb.id, 1)], asked),
    );
    expect(damageOn(r.state, identityOf(r.state))).toBe(2);
    expect(damageOn(r.state, hb.id)).toBe(0);
    // Offered: no more than 4 shares to X-23 (the total) and Honey Badger's 1.
    expect(asked.options).toHaveLength(5);
  });
  it("all 4 may go to X-23 even with Honey Badger hurt: 1 left on her, Honey Badger keeps 1", () => {
    const hb = withHoneyBadger(heroGame());
    const base = hurt(hurt(hb.state, identityOf(hb.state), 5), hb.id, 1);
    const r = playEvent(
      base,
      "43006",
      1,
      dividing((o) => ofCard(o, identityOf(base), 4)),
    );
    expect(damageOn(r.state, identityOf(r.state))).toBe(1);
    expect(damageOn(r.state, hb.id)).toBe(1);
  });
  it("heals no more than the damage there is: 2 on her and 1 on Honey Badger heals 3 in all", () => {
    const hb = withHoneyBadger(heroGame());
    const base = hurt(hurt(hb.state, identityOf(hb.state), 2), hb.id, 1);
    const r = playEvent(
      base,
      "43006",
      1,
      dividing((o) => o),
    );
    expect(damageOn(r.state, identityOf(r.state))).toBe(0);
    expect(damageOn(r.state, hb.id)).toBe(0);
  });
  it("Honey Badger alone hurt: she takes the heal (1 damage)", () => {
    const hb = withHoneyBadger(heroGame());
    const base = hurt(hb.state, hb.id, 1);
    const r = playEvent(
      base,
      "43006",
      1,
      dividing((o) => o),
    );
    expect(damageOn(r.state, hb.id)).toBe(0);
  });
  it("with nothing hurt it can still be played, healing nothing", () => {
    const r = playEvent(heroGame(), "43006", 1);
    expect(damageOn(r.state, identityOf(r.state))).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it('is a plain Action (the data prints "Action:"): playable in alter-ego form', () => {
    const g = given(setupGame(), "43006");
    expect(rejected(g.state, play(P1, g.id, payWith(g.state, P1, 1, [g.id])))).toBe(false);
  });
  it("two players: Spider-Man's damage is not healed and he is not offered", () => {
    const base = hurt(
      hurt(heroGame([X23, SPIDER_MAN]), identityOf(heroGame([X23, SPIDER_MAN])), 3),
      identityOf(heroGame([X23, SPIDER_MAN]), P2),
      3,
    );
    const asked: { options?: readonly string[] } = {};
    const r = playEvent(
      base,
      "43006",
      1,
      dividing(() => [], asked),
    );
    expect(damageOn(r.state, identityOf(r.state, P2))).toBe(3);
    expect(damageOn(r.state, identityOf(r.state, P1))).toBe(0);
  });
});

describe("Critical Hit (43016): play only with a side scheme in the victory display; Response, stun the enemy you attacked", () => {
  it("cannot be played (it is a Response, but its restriction is a constant) with no side scheme in the victory display", () => {
    expect(playRefused(heroGame(), "43016", 2)).toBe(true);
  });
  it("after you attack an enemy, stun it: pays 2, the minion (not defeated) is stunned and the card is discarded", () => {
    const base = withSideSchemeInVictory(heroGame());
    const m = withMinion(base, MERCENARY);
    const hand = given(m.state, "43016");
    const log = { offered: 0 };
    const r = driveEventsPicking(DEPS, hand.state, accepting(CRITICAL_HIT, log), basicAttack(hand.state, m.id));
    expect(log.offered).toBe(1);
    expect(damageOn(r.state, m.id)).toBe(1);
    expect(inst(r.state, m.id).statuses.stunned).toBe(1);
    expect(playerOf(r.state, P1).discard).toContain(hand.id);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(hand.state, P1).hand.length - 1 - 2);
  });
  it("the villain can be stunned too", () => {
    const base = withSideSchemeInVictory(heroGame());
    const hand = given(base, "43016");
    const r = driveEventsPicking(
      DEPS,
      hand.state,
      accepting(CRITICAL_HIT),
      basicAttack(hand.state, villainOf(hand.state)),
    );
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(1);
  });
  it("is optional: declined, nothing is stunned and nothing is paid", () => {
    const base = withSideSchemeInVictory(heroGame());
    const m = withMinion(base, MERCENARY);
    const hand = given(m.state, "43016");
    const r = driveEventsPicking(DEPS, hand.state, firstLegal, basicAttack(hand.state, m.id));
    expect(inst(r.state, m.id).statuses.stunned).toBe(0);
    expect(playerOf(r.state, P1).hand).toContain(hand.id);
  });
  it("if the attack defeats the enemy there is nothing left to stun and nothing breaks", () => {
    const base = withSideSchemeInVictory(heroGame());
    const m = withMinion(base, MERCENARY, { damage: 2 });
    const hand = given(m.state, "43016");
    const r = driveEventsPicking(DEPS, hand.state, accepting(CRITICAL_HIT), basicAttack(hand.state, m.id));
    expect(playerOf(r.state, P1).playArea).not.toContain(m.id);
    expect(inst(r.state, m.id).statuses.stunned).toBe(0);
  });
  it("not offered after Honey Badger's attack: it is you (your hero) who attacks", () => {
    const hb = withHoneyBadger(withSideSchemeInVictory(heroGame()));
    const m = withMinion(hb.state, MERCENARY);
    const hand = given(m.state, "43016");
    const log = { offered: 0 };
    driveEventsPicking(DEPS, hand.state, accepting(CRITICAL_HIT, log), basicAttack(hand.state, m.id, hb.id));
    expect(log.offered).toBe(0);
  });
  it("two players: not offered to X-23's player after Spider-Man's attack", () => {
    const base = withSideSchemeInVictory(heroGame([X23, SPIDER_MAN]));
    const hand = given(base, "43016");
    const p2 = turnOfP2(hand.state);
    const log = { offered: 0 };
    const r = driveEventsPicking(
      DEPS,
      p2,
      accepting(CRITICAL_HIT, log),
      basicAttack(p2, villainOf(p2), identityOf(p2, P2), P2),
    );
    expect(log.offered).toBe(0);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(0);
  });
});

describe("Moment of Triumph (43017): after you attack and defeat an enemy, heal 1 per point of excess damage", () => {
  /** X-23 with ATK 3 (Claw Mastery) and 5 damage, attacking a Mercenary with 1 hit point left: 2 excess. */
  const staged = (excessDamage = 2, hpLeft = 1) => {
    const boosted = hurt(playEvent(heroGame(), "43005", 1).state, identityOf(heroGame()), 5);
    const m = withMinion(boosted, MERCENARY, { damage: 3 - hpLeft });
    const hand = given(m.state, "43017");
    return { ...hand, minion: m.id, excessDamage };
  };
  it("costs 0: 2 excess damage heals 2 from X-23 (5 to 3)", () => {
    const s = staged();
    const log = { offered: 0 };
    const r = driveEventsPicking(DEPS, s.state, accepting(TRIUMPH, log), basicAttack(s.state, s.minion));
    expect(log.offered).toBe(1);
    expect(damageOn(r.state, identityOf(r.state))).toBe(3);
    expect(playerOf(r.state, P1).discard).toContain(s.id);
  });
  it("an exact kill (3 ATK on 3 hit points) has no excess: heals nothing", () => {
    const s = staged(0, 3);
    const r = driveEventsPicking(DEPS, s.state, accepting(TRIUMPH), basicAttack(s.state, s.minion));
    expect(damageOn(r.state, identityOf(r.state))).toBe(5);
  });
  it("is optional: declined, no heal", () => {
    const s = staged();
    const r = driveEventsPicking(DEPS, s.state, firstLegal, basicAttack(s.state, s.minion));
    expect(damageOn(r.state, identityOf(r.state))).toBe(5);
    expect(playerOf(r.state, P1).hand).toContain(s.id);
  });
  it("not offered when the enemy survives", () => {
    const m = withMinion(hurt(heroGame(), identityOf(heroGame()), 5), MERCENARY);
    const hand = given(m.state, "43017");
    const log = { offered: 0 };
    driveEventsPicking(DEPS, hand.state, accepting(TRIUMPH, log), basicAttack(hand.state, m.id));
    expect(log.offered).toBe(0);
  });
  it("heals only the damage there is: 1 damage on X-23 and 2 excess heals 1", () => {
    const boosted = hurt(playEvent(heroGame(), "43005", 1).state, identityOf(heroGame()), 1);
    const m = withMinion(boosted, MERCENARY, { damage: 2 });
    const hand = given(m.state, "43017");
    const r = driveEventsPicking(DEPS, hand.state, accepting(TRIUMPH), basicAttack(hand.state, m.id));
    expect(damageOn(r.state, identityOf(r.state))).toBe(0);
  });
  it("two players: not offered to X-23's player when Spider-Man defeats an enemy", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const hand = given(hurt(base, identityOf(base), 4), "43017");
    const m = withMinion(hand.state, MERCENARY, { damage: 2, player: P2 });
    const p2 = turnOfP2(m.state);
    const log = { offered: 0 };
    driveEventsPicking(DEPS, p2, accepting(TRIUMPH, log), basicAttack(p2, m.id, identityOf(p2, P2), P2));
    expect(log.offered).toBe(0);
  });
});

describe("Predictable Ploy (43038): play only with a side scheme in the victory display; cancel a treachery's When Revealed", () => {
  /**
   * Stacks one filler boost card (Assault, 0 icons) per activation and then Advance ("When Revealed: The villain
   * schemes.") for each player, and ends P1's turn. Advance's scheme is seen as threat on the main scheme.
   */
  const reveal = (state: GameState, pick: Picker, players = 1) =>
    driveEventsPicking(
      DEPS,
      stackEncounterDeck(
        state,
        ...Array.from({ length: players }, () => "01187"),
        ...Array.from({ length: players }, () => ADVANCE),
      ),
      pick,
      ...endTurns(players),
    );
  const threat = (s: GameState): number => inst(s, mainOf(s)).threat;
  it("cannot be played with no side scheme in the victory display", () => {
    expect(playRefused(heroGame(), "43038", 2)).toBe(true);
  });
  it("without it, Advance's When Revealed resolves and the villain schemes", () => {
    const base = withSideSchemeInVictory(heroGame());
    const r = reveal(base, firstLegal);
    expect(threat(r.state)).toBeGreaterThan(threat(base));
  });
  it("cancelled: the villain does not scheme, 2 cards are paid and the event is discarded; Advance still goes to the discard pile", () => {
    const g = given(withSideSchemeInVictory(heroGame()), "43038");
    const uncancelled = reveal(g.state, firstLegal);
    const log = { offered: 0 };
    const r = reveal(g.state, accepting(PLOY, log));
    expect(log.offered).toBe(1);
    expect(threat(r.state)).toBeLessThan(threat(uncancelled.state));
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(uncancelled.state, P1).hand.length - 3);
    const encounterDiscard = Object.values(r.state.encounterDecks).flatMap((d) => d.discard);
    expect(encounterDiscard.some((id) => codeOf(r.state, id) === ADVANCE)).toBe(true);
  });
  it("is optional: declined, the villain schemes as usual and the card is kept", () => {
    const g = given(withSideSchemeInVictory(heroGame()), "43038");
    const r = reveal(g.state, firstLegal);
    expect(threat(r.state)).toBeGreaterThan(threat(g.state));
    expect(playerOf(r.state, P1).hand).toContain(g.id);
  });
  it("not offered without a side scheme in the victory display (the card is not playable)", () => {
    const g = given(heroGame(), "43038");
    const log = { offered: 0 };
    reveal(g.state, accepting(PLOY, log));
    expect(log.offered).toBe(0);
  });
  it("two players: X-23's player may cancel the treachery revealed to Spider-Man's player (the text names no player)", () => {
    const g = given(withSideSchemeInVictory(heroGame([X23, SPIDER_MAN])), "43038");
    const both = reveal(g.state, firstLegal, 2);
    const log = { offered: 0 };
    // The first reveal is P1's own: decline it, cancel the second (P2's).
    const r = reveal(g.state, accepting(PLOY, log, { skip: 1 }), 2);
    expect(log.offered).toBe(2);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(threat(r.state)).toBeLessThan(threat(both.state));
  });
});

describe("Anticipated Attack (43040): play only with a side scheme in the victory display; Hero Interrupt, give your hero a tough status card", () => {
  /**
   * The villain phase after every turn ends, with a filler boost card (Assault, 0 icons, no boost ability) per
   * activation and Advance dealt to each player (it only makes the villain scheme), so the attack is the one source of
   * damage: Stryfe's ATK is read from `attackResolved`.
   */
  const villainPhase = (state: GameState, pick: Picker, players = 1) =>
    driveEventsPicking(
      DEPS,
      stackEncounterDeck(
        state,
        ...Array.from({ length: players }, () => "01187"),
        ...Array.from({ length: players }, () => ADVANCE),
      ),
      pick,
      ...endTurns(players),
    );
  const attackOn = (events: readonly { type: string }[], target: InstanceId) =>
    events.find(
      (e) =>
        e.type === "attackResolved" && (e as unknown as { targetInstanceId: InstanceId }).targetInstanceId === target,
    ) as unknown as { baseAtk: number; boostIcons: number; damageDealt: number } | undefined;
  it("cannot be played with no side scheme in the victory display", () => {
    expect(playRefused(heroGame(), "43040", 2)).toBe(true);
  });
  it("when an enemy initiates an attack: pays 2; the tough status card prevents all of the attack's damage and is discarded", () => {
    const base = heroGame();
    const baseline = villainPhase(base, firstLegal);
    const dealt = attackOn(baseline.events, identityOf(base))!.damageDealt;
    expect(dealt).toBeGreaterThan(0);
    expect(damageOn(baseline.state, identityOf(base))).toBe(dealt);
    const g = given(withSideSchemeInVictory(base), "43040");
    const log = { offered: 0 };
    const r = villainPhase(g.state, accepting(ANTICIPATED_ATTACK, log));
    expect(log.offered).toBe(1);
    const prevented = attackOn(r.events, identityOf(base))!.damageDealt;
    expect(prevented).toBeGreaterThan(0);
    expect(r.events).toContainEqual(
      expect.objectContaining({
        type: "damagePrevented",
        targetInstanceId: identityOf(base),
        amount: prevented,
        reason: "tough",
      }),
    );
    expect(damageOn(r.state, identityOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.tough).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(r.events).toContainEqual(expect.objectContaining({ type: "cardPlayed", cardId: "43040", resourcesPaid: 2 }));
  });
  it("it is labeled a defense: X-23 is the defender of that attack, and does not exhaust", () => {
    const g = given(withSideSchemeInVictory(heroGame()), "43040");
    const r = villainPhase(g.state, accepting(ANTICIPATED_ATTACK));
    expect(
      r.events.some(
        (e) => e.type === "triggerEvent" && (e as unknown as { event: { kind: string } }).event.kind === "defended",
      ),
    ).toBe(true);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
  });
  it("Living Weapon is not offered after it: the damage was wholly prevented, so none was taken", () => {
    const base = patchInstance(heroGame(), identityOf(heroGame()), { exhausted: true });
    const g = given(withSideSchemeInVictory(base), "43040");
    const lw = { offered: 0 };
    const pay = accepting(ANTICIPATED_ATTACK);
    const pick: Picker = (s) => {
      if (
        s.pendingChoice?.prompt.kind === "chooseTriggers" &&
        s.pendingChoice.options.some((o) => o.optionId.includes(LIVING_WEAPON))
      )
        lw.offered += 1;
      return pay(s);
    };
    const r = villainPhase(g.state, pick);
    expect(lw.offered).toBe(0);
    expect(damageOn(r.state, identityOf(r.state))).toBe(0);
  });
  it("is optional: declined, the attack damages her and Living Weapon is offered", () => {
    const g = given(withSideSchemeInVictory(heroGame()), "43040");
    const lw = { offered: 0 };
    const r = villainPhase(g.state, acceptingLivingWeapon(lw));
    expect(damageOn(r.state, identityOf(r.state))).toBeGreaterThan(0);
    expect(lw.offered).toBe(1);
    expect(playerOf(r.state, P1).hand).toContain(g.id);
  });
  it("is a hero interrupt: in alter-ego form it is not offered", () => {
    const g = given(withSideSchemeInVictory(setupGame()), "43040");
    const log = { offered: 0 };
    villainPhase(g.state, accepting(ANTICIPATED_ATTACK, log));
    expect(log.offered).toBe(0);
  });
  it("two players: the text names no target, so X-23's player may play it on the attack against Spider-Man; only X-23 gets tough", () => {
    const both = withForm(heroGame([X23, SPIDER_MAN]), { heroForm: 0 }, P2);
    const g = given(withSideSchemeInVictory(both), "43040");
    // Decline the first offer (the attack on X-23) and accept the second (the attack on Spider-Man's player).
    const log = { offered: 0 };
    const r = villainPhase(g.state, accepting(ANTICIPATED_ATTACK, log, { skip: 1 }), 2);
    expect(log.offered).toBe(2);
    // Being labeled a defense, it makes X-23 the defender of the attack on Spider-Man's player, who
    // becomes its target no longer: her new tough status card prevents all of that attack's damage and is spent.
    expect(r.events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", targetInstanceId: identityOf(r.state, P1), reason: "tough" }),
    );
    expect(inst(r.state, identityOf(r.state, P1)).statuses.tough).toBe(0);
    expect(damageOn(r.state, identityOf(r.state, P1))).toBeGreaterThan(0);
    expect(inst(r.state, identityOf(r.state, P2)).statuses.tough).toBe(0);
    expect(damageOn(r.state, identityOf(r.state, P2))).toBe(0);
  });
});

describe("Sisterly Bond (43007): Hero Interrupt, Honey Badger's basic thwart or attack adds X-23's matching power", () => {
  /** An ally put into a play area by surgery (no payment, no enter-play responses). */
  const allyInPlay = (state: GameState, code: string, player: PlayerId = P1) => {
    const g = injectIntoHand(state, player, code);
    return {
      id: g.id,
      state: {
        ...g.state,
        players: g.state.players.map((p) =>
          p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== g.id), playArea: [...p.playArea, g.id] } : p,
        ),
      },
    };
  };
  const BOOM_BOOM = "43013";
  /** Honey Badger (THW 1, ATK 1) in play beside X-23 (THW 2, ATK 1), Sisterly Bond in hand, a thwartable main scheme. */
  const staged = (opts: { claws?: boolean } = {}) => {
    const hb = allyInPlay(opts.claws ? playEvent(heroGame(), "43005", 1).state : heroGame(), HONEY_BADGER);
    const g = given(withoutSideSchemes(hb.state), "43007");
    return { state: g.state, hb: hb.id, card: g.id };
  };
  const thwartWith = (st: ReturnType<typeof staged>, pick: Picker) => {
    const r = driveEventsPicking(DEPS, st.state, pick, basicThwart(st.state, mainOf(st.state), st.hb));
    return { ...r, removed: inst(st.state, mainOf(st.state)).threat - inst(r.state, mainOf(r.state)).threat };
  };
  const attackWith = (st: ReturnType<typeof staged>, pick: Picker) => {
    const r = driveEventsPicking(DEPS, st.state, pick, basicAttack(st.state, villainOf(st.state), st.hb));
    return { ...r, dealt: damageOn(r.state, villainOf(r.state)) - damageOn(st.state, villainOf(st.state)) };
  };
  it("without it Honey Badger thwarts for 1 and attacks for 1", () => {
    expect(thwartWith(staged(), firstLegal).removed).toBe(1);
    expect(attackWith(staged(), firstLegal).dealt).toBe(1);
  });
  it("her basic thwart gains X-23's THW: 1 + 2 = 3; cost 0, and the event is discarded", () => {
    const st = staged();
    const log = { offered: 0 };
    const r = thwartWith(st, accepting(SISTERLY_BOND, log));
    expect(log.offered).toBe(1);
    expect(r.removed).toBe(3);
    expect(playerOf(r.state, P1).discard).toContain(st.card);
  });
  it("her basic attack gains X-23's ATK: 1 + 1 = 2", () => {
    expect(attackWith(staged(), accepting(SISTERLY_BOND)).dealt).toBe(2);
  });
  it("the amount is live: with Claw Mastery's +2 ATK (3) her attack deals 1 + 3 = 4, her thwart still 1 + 2 = 3", () => {
    expect(attackWith(staged({ claws: true }), accepting(SISTERLY_BOND)).dealt).toBe(4);
    expect(thwartWith(staged({ claws: true }), accepting(SISTERLY_BOND)).removed).toBe(3);
  });
  // docs/phase7-wave8.md §4.1 Q54 = B; RRG 1.8 "Assault" (p. 8): the thwart uses ATK, so the matching power is ATK.
  describe("a basic thwart made with ATK (Keep Them Busy 43018, a player side scheme with Assault)", () => {
    /** Claw Mastery played (X-23 THW 2, ATK 3), Keep Them Busy in play with 10 threat. */
    const stagedAssault = () => {
      const st = staged({ claws: true });
      const g = given(st.state, "43018");
      const state: GameState = {
        ...g.state,
        players: g.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== g.id) } : p,
        ),
        villainArea: [...g.state.villainArea, g.id],
      };
      return { ...st, state: patchInstance(state, g.id, { threat: 10, faceup: true }), scheme: g.id };
    };
    const thwartScheme = (st: ReturnType<typeof stagedAssault>, pick: Picker) => {
      const r = driveEventsPicking(DEPS, st.state, pick, basicThwart(st.state, st.scheme, st.hb));
      return 10 - inst(r.state, st.scheme).threat;
    };
    it("without it Honey Badger removes her ATK 1 from it", () => {
      expect(thwartScheme(stagedAssault(), firstLegal)).toBe(1);
    });
    it("she gains X-23's ATK 3, not her THW 2: 1 + 3 = 4 removed", () => {
      expect(thwartScheme(stagedAssault(), accepting(SISTERLY_BOND))).toBe(4);
    });
    it("the same table's ordinary thwart of the main scheme still gains X-23's THW 2: 1 + 2 = 3", () => {
      expect(thwartWith(stagedAssault(), accepting(SISTERLY_BOND)).removed).toBe(3);
    });
  });
  it("is optional: declined, she deals 1 and the card stays in hand", () => {
    const st = staged();
    const r = attackWith(st, firstLegal);
    expect(r.dealt).toBe(1);
    expect(playerOf(r.state, P1).hand).toContain(st.card);
  });
  it("the bonus ends with that use: her next basic thwart (readied) removes 1", () => {
    const st = staged();
    const first = thwartWith(st, accepting(SISTERLY_BOND));
    const ready = patchInstance(first.state, st.hb, { exhausted: false });
    const second = driveEventsPicking(DEPS, ready, firstLegal, basicThwart(ready, mainOf(ready), st.hb));
    expect(inst(ready, mainOf(ready)).threat - inst(second.state, mainOf(second.state)).threat).toBe(1);
  });
  it("is not offered for X-23's own thwart or attack", () => {
    const st = staged();
    const log = { offered: 0 };
    driveEventsPicking(DEPS, st.state, accepting(SISTERLY_BOND, log), basicThwart(st.state, mainOf(st.state)));
    driveEventsPicking(DEPS, st.state, accepting(SISTERLY_BOND, log), basicAttack(st.state, villainOf(st.state)));
    expect(log.offered).toBe(0);
  });
  it("is not offered for another ally (Boom Boom)", () => {
    const st = staged();
    const other = allyInPlay(st.state, BOOM_BOOM);
    const log = { offered: 0 };
    driveEventsPicking(
      DEPS,
      other.state,
      accepting(SISTERLY_BOND, log),
      basicThwart(other.state, mainOf(other.state), other.id),
    );
    expect(log.offered).toBe(0);
  });
  it("is a hero interrupt: in alter-ego form it is not offered for Honey Badger's attack", () => {
    const hb = allyInPlay(setupGame(), HONEY_BADGER);
    const g = given(hb.state, "43007");
    const log = { offered: 0 };
    driveEventsPicking(DEPS, g.state, accepting(SISTERLY_BOND, log), basicAttack(g.state, villainOf(g.state), hb.id));
    expect(log.offered).toBe(0);
  });
  it("two players: not offered for the other player's ally, and Spider-Man's ATK adds nothing to Honey Badger", () => {
    const base = allyInPlay(heroGame([X23, SPIDER_MAN]), HONEY_BADGER);
    const g = given(withoutSideSchemes(base.state), "43007");
    const theirs = allyInPlay(g.state, BOOM_BOOM, P2);
    const p2 = turnOfP2(theirs.state);
    const log = { offered: 0 };
    const main = mainOf(p2);
    driveEventsPicking(
      DEPS,
      patchInstance(p2, main, { threat: 10 }),
      accepting(SISTERLY_BOND, log),
      basicThwart(p2, main, theirs.id, P2),
    );
    expect(log.offered).toBe(0);
    // Back on X-23's side the bonus is hers alone: 1 + 2.
    const own = driveEventsPicking(
      DEPS,
      g.state,
      accepting(SISTERLY_BOND),
      basicThwart(g.state, mainOf(g.state), base.id),
    );
    expect(inst(g.state, mainOf(g.state)).threat - inst(own.state, mainOf(own.state)).threat).toBe(3);
  });
});
