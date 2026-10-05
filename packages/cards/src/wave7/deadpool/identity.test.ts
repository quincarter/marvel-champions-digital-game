import { applyCommand, createGame, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, dealDamage, yourIdentity } from "../../dsl/index.js";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { DEADPOOL_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadpool / Wade Wilson (44001a/b), docs/phase7-wave7.md §7.3, §3.78. His precon (`deadpool-pool`) against Stryfe
 * through `wave7Scenario`. Alter-ego Wade Wilson: REC 8, hand size 6; hero Deadpool: THW 2, ATK 2, DEF 1, hand size
 * 5, 9 hit points. Being a 'Pool deck it brings Crisis of Infinite Deadpools 44037 into the encounter deck; no test
 * here reveals an encounter card except the one villain-phase case, which checks it did not.
 *
 * Fixtures from his own kit by printed id, whose own abilities are other modules' and may be scripted by now, so this
 * file overrides their refs in its own `DEPS` with inert stand-ins: 44003 (an event, cost 0) deals 9 damage to his
 * identity (exactly his hit points), 44004 (cost 0) deals 20 (far more than he has), 44006 (cost 1) deals 4. 44003,
 * 44004, 44005, 44006 and 44012 are Deadpool events (his own identity set); 44017 (a 'Pool event) and 01005 (a
 * Spider-Man event) are events that are not.
 */
const REGEN = "44001a.the-regeneratin-degenerate";
const WALL = "44001b.break-the-fourth-wall";
const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof DEADPOOL | typeof SPIDER_MAN;

const HURT_9 = "44003";
const HURT_20 = "44004";
const HURT_4 = "44006";
const POOL_EVENT = "44017";
const WEB_KICK = "01005";

const FIXTURES = defineAbilities({
  "44003.exhausting-personality-action": action(dealDamage(9, yourIdentity)),
  "44004.maximum-effort-action": action(dealDamage(20, yourIdentity)),
  "44006.yoo-hoo-action": action(dealDamage(4, yourIdentity)),
  "01005.swinging-web-kick-action": action(dealDamage(20, yourIdentity)),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

function setupGame(players: readonly Seat[] = [DEADPOOL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (players?: readonly Seat[], seed = 1, player = P1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 }, player);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const damageOn = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const tokens = (s: GameState): number => s.mainScheme!.accelerationTokens;
const formOf = (s: GameState, p = P1) => playerOf(s, p).identity.form;

/** Plays the event `code` from hand for its cost; the picker answers every prompt. */
function playEvent(state: GameState, code: string, pick: Picker = firstLegal, player = P1, cost = 0) {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const { state: after, events } = driveEventsPicking(
    DEPS,
    given.state,
    pick,
    play(player, id, payWith(given.state, player, cost, [id])),
  );
  return { state: after, events, id };
}

/** The Action: discard `pay` from hand, and (at the search prompt) take the first deck card of `take`, if any. */
const wall = (s: GameState, pay?: InstanceId) =>
  use(P1, identityOf(s), WALL, [], { discard: [pay ?? playerOf(s, P1).hand[0]!] });
const taking = (s: GameState, code: string | null): Picker => {
  return (state) => {
    const choice = state.pendingChoice;
    if (choice && choice.prompt.kind === "chooseCards") {
      if (code === null) return [];
      const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === code);
      return hit ? [hit.optionId] : [];
    }
    return firstLegal(state);
  };
};

describe("Deadpool identity registry", () => {
  it.each([REGEN, WALL])("%s validates", (id) => {
    expect(validateDefinition(DEADPOOL_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the two identity refs", () => {
    expect(Object.keys(DEADPOOL_IDENTITY).sort()).toEqual([REGEN, WALL].sort());
  });
});

describe("Deadpool (44001a): The Regeneratin' Degenerate", () => {
  it("exactly lethal damage: hit points go to 1 (damage 8 of 9), he is Wade Wilson, and 1 acceleration token is added", () => {
    const base = heroGame();
    expect(damageOn(base)).toBe(0);
    const t0 = tokens(base);
    const { state } = playEvent(base, HURT_9);
    expect(state.outcome).toBeNull();
    expect(damageOn(state)).toBe(8);
    expect(formOf(state)).toBe("alterEgo");
    expect(tokens(state)).toBe(t0 + 1);
    expect(playerOf(state, P1).eliminated).toBe(false);
  });
  it("damage past zero is ignored: 20 damage still leaves him at 1 hit point", () => {
    const base = heroGame();
    const { state } = playEvent(base, HURT_20);
    expect(damageOn(state)).toBe(8);
    expect(formOf(state)).toBe("alterEgo");
    expect(tokens(state)).toBe(tokens(base) + 1);
  });
  it("short of lethal nothing is replaced: 4 damage leaves hero form, 4 damage and no token", () => {
    const base = heroGame();
    const { state } = playEvent(base, HURT_4, firstLegal, P1, 1);
    expect(damageOn(state)).toBe(4);
    expect(formOf(state)).toBe("hero");
    expect(tokens(state)).toBe(tokens(base));
  });
  it("it can happen any number of times, each adding a token and none removing one", () => {
    const base = heroGame();
    const one = playEvent(base, HURT_9).state;
    const again = playEvent(withForm(withDamage(one, identityOf(one), 0), { heroForm: 0 }), HURT_9).state;
    expect(damageOn(again)).toBe(8);
    expect(tokens(again)).toBe(tokens(base) + 2);
    const third = playEvent(withForm(withDamage(again, identityOf(again), 0), { heroForm: 0 }), HURT_20).state;
    expect(tokens(third)).toBe(tokens(base) + 3);
    expect(formOf(third)).toBe("alterEgo");
  });
  it("the change of form is an effect, not his once-per-round change: he may change to hero form afterwards", () => {
    const base = heroGame();
    const { state } = playEvent(base, HURT_9);
    expect(playerOf(state, P1).identity.changedFormThisRound).toBe(false);
    const r = applyCommand(state, { type: "changeForm", playerId: P1 } as never, DEPS);
    expect(r.ok).toBe(true);
  });
  it("printed on the hero face only: Wade Wilson at 0 hit points is eliminated, no token added", () => {
    const base = setupGame();
    expect(formOf(base)).toBe("alterEgo");
    const { state } = playEvent(base, HURT_9);
    expect(damageOn(state)).toBeGreaterThanOrEqual(9);
    expect(tokens(state)).toBe(tokens(base));
    expect(playerOf(state, P1).eliminated).toBe(true);
    expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
  });
  it("a villain attack that kills him: he survives at 1 hit point as Wade Wilson, one token added, the game goes on", () => {
    const start = withDamage(heroGame(), identityOf(heroGame()), 8);
    const next = settle(
      driveEventsPicking(DEPS, start, firstLegal, endTurn(P1)).state,
      firstLegal,
      (s) => s.step.phase === "player" && s.round > start.round,
      DEPS,
    );
    expect(next.round).toBe(start.round + 1);
    expect(damageOn(next)).toBeLessThanOrEqual(8);
    expect(formOf(next)).toBe("alterEgo");
    expect(tokens(next)).toBeGreaterThan(tokens(start));
  });
  it("two players: only Deadpool's own defeat is replaced, and it is the shared main scheme that gains the token", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const { state } = playEvent(base, HURT_9);
    expect(damageOn(state, P1)).toBe(8);
    expect(damageOn(state, P2)).toBe(0);
    expect(formOf(state, P2)).toBe(formOf(base, P2));
    expect(tokens(state)).toBe(tokens(base) + 1);
  });
  it("two players, another player's identity defeated beside Deadpool: not replaced and no token (it says 'you')", () => {
    const base = heroGame([SPIDER_MAN, DEADPOOL]);
    const { state } = playEvent(base, WEB_KICK, firstLegal, P1, 3);
    expect(playerOf(state, P1).eliminated).toBe(true);
    expect(playerOf(state, P2).eliminated).toBe(false);
    expect(tokens(state)).toBe(tokens(base));
    expect(damageOn(state, P2)).toBe(0);
  });
});

describe("Wade Wilson (44001b): Break the Fourth Wall (Action)", () => {
  it("discards a card from hand and adds a Deadpool event from the deck to hand", () => {
    const base = setupGame();
    const target = deckCodes(base).includes("44012") ? "44012" : deckCodes(base).find((c) => /^4400[3-6]$/.test(c))!;
    const hand = playerOf(base, P1).hand;
    const pay = hand[0]!;
    const { state } = driveEventsPicking(DEPS, base, taking(base, target), wall(base, pay));
    expect(playerOf(state, P1).hand).not.toContain(pay);
    expect(discardCodes(state)).toContain(codeOf(base, pay));
    expect(handCodes(state)).toContain(target);
    expect(playerOf(state, P1).hand).toHaveLength(hand.length);
    expect(deckCodes(state).length).toBe(deckCodes(base).length - 1);
  });
  it("only his own events qualify: a 'Pool event and a Spider-Man event are not offered", () => {
    const base = setupGame();
    let offered: string[] = [];
    const watch: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards") {
        offered = s.pendingChoice.options.map((o) => codeOf(s, o.optionId as InstanceId));
        return [];
      }
      return firstLegal(s);
    };
    driveEventsPicking(DEPS, base, watch, wall(base));
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((c) => ["44003", "44004", "44005", "44006", "44012"].includes(c))).toBe(true);
    expect(offered).not.toContain(POOL_EVENT);
    expect(deckCodes(base)).toContain(POOL_EVENT);
  });
  it("finding none is allowed: the card is still discarded, nothing is added, and it counts as used", () => {
    const base = setupGame();
    const { state } = driveEventsPicking(DEPS, base, taking(base, null), wall(base));
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(base, P1).hand.length - 1);
    expect(deckCodes(state).length).toBe(deckCodes(base).length);
    expect(applyCommand(state, wall(state), DEPS).ok).toBe(false);
  });
  it("a deck holding no Deadpool event can still start it (a search needs only a searchable area)", () => {
    const start = setupGame();
    const emptied = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.filter((id) => !["44003", "44004", "44005", "44006", "44012"].includes(codeOf(start, id))),
            }
          : p,
      ),
    };
    const { state } = driveEventsPicking(DEPS, emptied, firstLegal, wall(emptied));
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(emptied, P1).hand.length - 1);
  });
  it("the deck is shuffled after the search (RRG Search, p. 39): the rest of the deck keeps its cards, the seeded RNG advanced", () => {
    const base = setupGame();
    const { state } = driveEventsPicking(DEPS, base, taking(base, "44004"), wall(base));
    const rest = [...deckCodes(base)];
    rest.splice(rest.indexOf("44004"), 1);
    expect([...deckCodes(state)].sort()).toEqual(rest.sort());
    expect(state.rng).not.toEqual(base.rng);
  });
  it("once per round: a second use the same round is refused", () => {
    const base = setupGame();
    const one = driveEventsPicking(DEPS, base, taking(base, "44004"), wall(base)).state;
    expect(applyCommand(one, wall(one), DEPS).ok).toBe(false);
  });
  it("needs a card to discard: an empty hand cannot start it, and nothing is used", () => {
    const base = setupGame();
    const empty = { ...base, players: base.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) };
    const r = applyCommand(empty, use(P1, identityOf(empty), WALL, [], { discard: [] }), DEPS);
    expect(r.ok).toBe(false);
  });
  it("is an alter-ego Action: refused while Deadpool shows", () => {
    const base = heroGame();
    expect(applyCommand(base, wall(base), DEPS).ok).toBe(false);
  });
  it("two players: only the Deadpool player's hand and deck are touched", () => {
    const base = setupGame([DEADPOOL, SPIDER_MAN]);
    const { state } = driveEventsPicking(DEPS, base, taking(base, "44004"), wall(base));
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(base, P1).hand.length);
    expect(playerOf(state, P2).hand).toEqual(playerOf(base, P2).hand);
    expect(playerOf(state, P2).deck).toEqual(playerOf(base, P2).deck);
    expect(handCodes(state)).toContain("44004");
  });
});
