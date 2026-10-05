import { applyCommand, createGame, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, dealDamage, draw, heroAction, takeDamageCost, yourIdentity } from "../../dsl/index.js";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { X23_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * X-23 / Laura Kinney (43001a/b), docs/phase7-wave7.md §7.3, §3.85. Her precon (`x-23-aggression`) against Stryfe
 * through `wave7Scenario`. Alter-ego Laura Kinney: REC 6, hand size 6; hero X-23: THW 2, ATK 1, DEF 2, hand size 5,
 * 10 hit points.
 *
 * Fixtures from her own kit by printed id, whose abilities are other modules' and may be scripted by now, so this
 * file overrides their refs in its own `DEPS` with inert stand-ins that do only what a test needs: 43004 (an event,
 * cost 0) deals 2 damage to X-23's identity, and X-23's Claws (43002, in play from the Setup) is given a hero Action
 * whose cost is 2 damage to her (the printed Claws and Grim Resolve pay damage as a cost the same way), 43003 Honey Badger (ally) and 43007 Sisterly Bond (event) are the
 * two cards the Action shuffles back, and 43006 Regenerative Longevity (event) is a card it must not shuffle.
 */
const LIVING_WEAPON = "43001a.living-weapon";
const SHHNK = "43001b.shhnk";
const LAURA = "43001b.laura-kinney-action";
const X23 = { starterDeckId: "x-23-aggression" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof X23 | typeof SPIDER_MAN;

const CLAWS = "43002";
const HONEY_BADGER = "43003";
const HURT_2 = "43004";
const LONGEVITY = "43006";
const SISTERLY_BOND = "43007";

const FIXTURES = defineAbilities({
  "43004.animal-instinct-interrupt": action(dealDamage(2, yourIdentity)),
  "43002.x-23s-claws-action": heroAction({ cost: takeDamageCost(2) }, draw(0)),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

function setupGame(players: readonly Seat[] = [X23], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (players?: readonly Seat[], seed = 1, player = P1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 }, player);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handSize = (s: GameState, p = P1): number => playerOf(s, p).hand.length;
const deckSize = (s: GameState, p = P1): number => playerOf(s, p).deck.length;
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const exhausted = (s: GameState, p = P1): boolean => inst(s, identityOf(s, p)).exhausted;
const exhaust = (s: GameState, p = P1): GameState => patchInstance(s, identityOf(s, p), { exhausted: true });

/** Accepts Living Weapon when a response prompt offers it (logging that), declines any other trigger. */
function accepting(log: { offered: number } = { offered: 0 }): Picker {
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
/** Plays the event `code` from hand for its cost; the picker answers every prompt. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker, player = P1) {
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
const withDiscard = (s: GameState, ...codes: string[]): GameState =>
  codes.reduce((acc, code) => moveToDiscard(acc, P1, code).state, s);
/** The Action, choosing `card` (default: the first Honey Badger or Sisterly Bond in the discard pile). */
const laura = (s: GameState, card?: InstanceId) => {
  const pick = card ?? playerOf(s, P1).discard.find((id) => [HONEY_BADGER, SISTERLY_BOND].includes(codeOf(s, id)));
  return use(P1, identityOf(s), LAURA, [], pick ? { card: [pick] } : { card: [] });
};
const discardId = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).discard.find((id) => codeOf(s, id) === code)!;
const useClaws = (s: GameState) => use(P1, instancesOf(s, CLAWS)[0]!, "43002.x-23s-claws-action");

describe("X-23 identity registry", () => {
  it.each([LIVING_WEAPON, SHHNK, LAURA])("%s validates", (id) => {
    expect(validateDefinition(X23_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs", () => {
    expect(Object.keys(X23_IDENTITY).sort()).toEqual([LIVING_WEAPON, SHHNK, LAURA].sort());
  });
});

describe("Laura Kinney (43001b): Shhnk! (Setup)", () => {
  it("puts X-23's Claws into play attached to her identity, controlled by her, ready and unexhausted", () => {
    const s = setupGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const claws = instancesOf(s, CLAWS);
    expect(claws).toHaveLength(1);
    expect(inst(s, claws[0]!).attachedTo).toBe(identityOf(s));
    expect(inst(s, claws[0]!).controllerId).toBe(P1);
    expect(inst(s, claws[0]!).exhausted).toBe(false);
    expect(inst(s, identityOf(s)).attachments).toContain(claws[0]);
  });
  it("the permanent is no part of the deck: hand of 6 plus the deck is 40 cards, no Claws in hand, deck or discard", () => {
    const s = setupGame();
    expect(handSize(s)).toBe(6);
    expect(handSize(s) + deckSize(s)).toBe(40);
    expect(deckCodes(s)).not.toContain(CLAWS);
    expect(playerOf(s, P1).hand.map((id) => codeOf(s, id))).not.toContain(CLAWS);
    expect(discardCodes(s)).toHaveLength(0);
    expect(damageOn(s, identityOf(s))).toBe(0);
  });
  it("two players: only X-23's player gets the Claws", () => {
    const s = setupGame([X23, SPIDER_MAN]);
    expect(instancesOf(s, CLAWS)).toHaveLength(1);
    expect(inst(s, instancesOf(s, CLAWS)[0]!).attachedTo).toBe(identityOf(s, P1));
    expect(inst(s, identityOf(s, P2)).attachments.some((id) => codeOf(s, id) === CLAWS)).toBe(false);
  });
});

describe("Laura Kinney (43001b): Action, shuffle Honey Badger or Sisterly Bond from the discard pile -> draw 1", () => {
  it("Honey Badger: leaves the discard pile for the deck (shuffled), then 1 card is drawn: hand +1, deck unchanged", () => {
    const base = withDiscard(setupGame(), HONEY_BADGER);
    expect(discardCodes(base)).toEqual([HONEY_BADGER]);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, laura(base));
    expect(discardCodes(state)).toEqual([]);
    expect(handSize(state)).toBe(handSize(base) + 1);
    // 1 shuffled in, 1 drawn: the deck is the same size, and the card is in the deck or the hand.
    expect(deckSize(state)).toBe(deckSize(base));
    const holders = [...playerOf(state, P1).deck, ...playerOf(state, P1).hand].map((id) => codeOf(state, id));
    expect(holders.filter((c) => c === HONEY_BADGER)).toHaveLength(1);
  });
  it("Sisterly Bond works the same way", () => {
    const base = withDiscard(setupGame(), SISTERLY_BOND);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, laura(base));
    expect(discardCodes(state)).toEqual([]);
    expect(handSize(state)).toBe(handSize(base) + 1);
    expect(deckSize(state)).toBe(deckSize(base));
  });
  it("with both in the discard pile exactly the chosen one is shuffled in: choosing Sisterly Bond leaves Honey Badger", () => {
    const base = withDiscard(setupGame(), HONEY_BADGER, SISTERLY_BOND);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, laura(base, discardId(base, SISTERLY_BOND)));
    expect(discardCodes(state)).toEqual([HONEY_BADGER]);
    expect(handSize(state)).toBe(handSize(base) + 1);
    expect(deckSize(state)).toBe(deckSize(base));
  });
  it("another card is no candidate: Regenerative Longevity cannot be chosen, nothing is spent or drawn", () => {
    const base = withDiscard(setupGame(), LONGEVITY);
    const r = applyCommand(base, laura(base, discardId(base, LONGEVITY)), DEPS);
    expect(r.ok).toBe(false);
    const empty = applyCommand(base, laura(base), DEPS);
    expect(empty.ok).toBe(false);
    expect(discardCodes(base)).toEqual([LONGEVITY]);
  });
  it("an empty discard pile: the Action cannot be started", () => {
    const base = setupGame();
    expect(applyCommand(base, laura(base), DEPS).ok).toBe(false);
  });
  it("once per round: a second use the same round is refused even with another candidate in the discard pile", () => {
    const base = withDiscard(setupGame(), HONEY_BADGER, SISTERLY_BOND);
    const one = driveEventsPicking(DEPS, base, firstLegal, laura(base)).state;
    expect(discardCodes(one)).toHaveLength(1);
    expect(applyCommand(one, laura(one), DEPS).ok).toBe(false);
  });
  it("is an alter-ego Action: refused while X-23 shows", () => {
    const base = withDiscard(heroGame(), HONEY_BADGER);
    expect(applyCommand(base, laura(base), DEPS).ok).toBe(false);
  });
  it("two players: only the Laura Kinney player's own hand grows and her own discard pile is read", () => {
    const base = withDiscard(setupGame([X23, SPIDER_MAN]), HONEY_BADGER);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, laura(base));
    expect(handSize(state, P1)).toBe(handSize(base, P1) + 1);
    expect(handSize(state, P2)).toBe(handSize(base, P2));
    expect(deckSize(state, P2)).toBe(deckSize(base, P2));
  });
});

describe("X-23 (43001a): Living Weapon", () => {
  it("after X-23 takes damage (an event's 2), ready X-23: an exhausted identity is readied by the offered response", () => {
    const base = exhaust(heroGame());
    expect(exhausted(base)).toBe(true);
    const log = { offered: 0 };
    const { state } = playEvent(base, HURT_2, 0, accepting(log));
    expect(log.offered).toBe(1);
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(exhausted(state)).toBe(false);
  });
  it("is optional: declining leaves her exhausted", () => {
    const base = exhaust(heroGame());
    const decline: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s));
    const { state } = playEvent(base, HURT_2, 0, decline);
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(exhausted(state)).toBe(true);
  });
  it("answers damage paid as a cost (the Claws, Grim Resolve): 2 damage paid readies her", () => {
    const base = exhaust(heroGame());
    const log = { offered: 0 };
    const { state } = driveEventsPicking(DEPS, base, accepting(log), useClaws(base));
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(log.offered).toBe(1);
    expect(exhausted(state)).toBe(false);
  });
  it("once per phase: a second damage in the same phase is not offered it again", () => {
    const base = exhaust(heroGame());
    const log = { offered: 0 };
    const one = playEvent(base, HURT_2, 0, accepting(log));
    expect(log.offered).toBe(1);
    expect(exhausted(one.state)).toBe(false);
    const two = playEvent(exhaust(one.state), HURT_2, 0, accepting(log));
    expect(log.offered).toBe(1);
    expect(damageOn(two.state, identityOf(two.state))).toBe(4);
    expect(exhausted(two.state)).toBe(true);
  });
  it("damage a tough status card wholly prevents is not 'any amount': not offered, she stays exhausted", () => {
    const start = heroGame();
    const base = patchInstance(start, identityOf(start), {
      exhausted: true,
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const log = { offered: 0 };
    const { state } = playEvent(base, HURT_2, 0, accepting(log));
    expect(log.offered).toBe(0);
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(exhausted(state)).toBe(true);
  });
  it("is a hero-face ability: in alter-ego form damage to Laura Kinney does not offer it", () => {
    const base = exhaust(setupGame());
    const log = { offered: 0 };
    const { state } = playEvent(base, HURT_2, 0, accepting(log));
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(log.offered).toBe(0);
    expect(exhausted(state)).toBe(true);
  });
  it("a villain attack in the villain phase: she takes damage, is offered it once, and is ready for her next turn", () => {
    const log = { offered: 0 };
    const base = heroGame();
    const next = settle(
      driveEventsPicking(DEPS, base, accepting(log), endTurn(P1)).state,
      accepting(log),
      (s) => s.step.phase === "player" && s.round > base.round,
      DEPS,
    );
    expect(next.round).toBe(base.round + 1);
    expect(damageOn(next, identityOf(next))).toBeGreaterThan(0);
    expect(log.offered).toBe(1);
    expect(exhausted(next)).toBe(false);
  });
  it("two players: Living Weapon answers only damage to X-23's own identity", () => {
    // Spider-Man is P1, X-23 is P2; a fixture hurts only P1's identity through a patch-free path: the villain phase.
    const log = { offered: 0 };
    const start = withForm(heroGame([SPIDER_MAN, X23]), { heroForm: 0 }, P2);
    const one = driveEventsPicking(DEPS, start, accepting(log), endTurn(P1)).state;
    const after = settle(
      driveEventsPicking(DEPS, one, accepting(log), endTurn(P2)).state,
      accepting(log),
      (s) => s.step.phase === "player" && s.round > start.round,
      DEPS,
    );
    const hurt = damageOn(after, identityOf(after, P2)) > 0;
    // Someone was attacked, and the response is offered exactly when it was X-23.
    expect(damageOn(after, identityOf(after, P1)) + damageOn(after, identityOf(after, P2))).toBeGreaterThan(0);
    expect(log.offered).toBe(hurt ? 1 : 0);
  });
});
