import { activeVillain, applyCommand, createGame, type Command, type EngineDeps, type GameState } from "@mc/engine";
import type { InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, changeToHeroFormNamed, draw } from "../../dsl/index.js";
import { validateDefinition, defineAbilities } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { ANGEL_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Angel / Warren Worthington III / Archangel (42001a/b/c), docs/phase7-wave7.md §7.2, §3.62, §3.63. His precon
 * (`angel-protection`) against Stryfe through `wave7Scenario`. Alter-ego Warren: REC 3, hand size 6; hero Angel
 * (`heroForm: 0`): THW 2, ATK 1, DEF 2, hand size 5; Archangel (`heroForm: 1`): THW 0, ATK 2, DEF 3, hand size 5,
 * with a printed acceleration icon; 12 hit points.
 *
 * Fixtures from his own kit by printed id, whose own abilities are other modules' and may be scripted by now, so this
 * file overrides their refs in its own `DEPS` with inert stand-ins (they cost and discard as the printed card does,
 * and do nothing else): 42015 Ever Vigilant (AERIAL event, cost 2), 42007 Razor Dive (AERIAL event, cost 3) and
 * 42016 Taunt (a TACTIC event, cost 1, not AERIAL). 42005 Metamorphosis (AERIAL event, cost 2) stands in as an event
 * whose resolution changes the form: "change to Archangel form". 01005 Swinging Web Kick (Spider-Man's own AERIAL
 * event, cost 3) is the other player's AERIAL event in the two-player cases.
 */
const LIFE = "42001a.angel-of-life";
const REGROWTH = "42001b.regrowth";
const DEATH = "42001c.angel-of-death";
const ANGEL = { starterDeckId: "angel-protection" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof ANGEL | typeof SPIDER_MAN;

const VIGILANT = "42015"; // AERIAL event, printed cost 2
const RAZOR_DIVE = "42007"; // AERIAL event, printed cost 3
const TAUNT = "42016"; // TACTIC event, printed cost 1
const METAMORPHOSIS = "42005"; // AERIAL event, printed cost 2
const WEB_KICK = "01005"; // AERIAL event, printed cost 3

const FIXTURES = defineAbilities({
  "42015.ever-vigilant-action": action(draw(0)),
  "42007.razor-dive-action": action(draw(0)),
  "42016.taunt-action": action(draw(0)),
  "42005.metamorphosis-action": action(changeToHeroFormNamed("Archangel")),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

function setupGame(players: readonly Seat[] = [ANGEL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const WARREN = { alterEgo: true } as const;
const ANGEL_FACE = { heroForm: 0 } as const;
const ARCHANGEL = { heroForm: 1 } as const;
const inForm = (to: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[], seed = 1) => {
  const base = setupGame(players, seed);
  return "alterEgo" in to ? base : withForm(base, to);
};

const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const handSize = (s: GameState, p = P1): number => playerOf(s, p).hand.length;
const deckSize = (s: GameState, p = P1): number => playerOf(s, p).deck.length;
const formOf = (s: GameState, p = P1) => playerOf(s, p).identity;

/** Accepts the ability with this id when a response prompt offers it (logging that it was offered), declines others. */
function accepting(ref: string, log: { offered: string[] } = { offered: [] }): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      for (const o of choice.options) if (o.optionId.includes("42001")) log.offered.push(o.optionId);
      const hit = choice.options.find((o) => o.optionId.includes(ref));
      return hit ? [hit.optionId] : [];
    }
    return firstLegal(s);
  };
}

/** Moves `code` into hand and plays it, paying with the next `cost` other cards; `pick` answers every prompt. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker,
  player = P1,
): { state: GameState; offered: string[]; before: number } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const log = { offered: [] as string[] };
  const logging: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      for (const o of choice.options) if (o.optionId.includes("42001")) log.offered.push(o.optionId);
    return pick(s);
  };
  const { state: after } = driveEventsPicking(
    DEPS,
    given.state,
    logging,
    play(player, id, payWith(given.state, player, cost, [id])),
  );
  return { state: after, offered: log.offered, before: handSize(given.state, player) };
}
/** Test-only surgery: the top `n` deck cards into hand, so a later play has cards to pay with. */
const topUp = (s: GameState, n: number, p = P1): GameState => ({
  ...s,
  players: s.players.map((pl) =>
    pl.playerId === p ? { ...pl, deck: pl.deck.slice(n), hand: [...pl.hand, ...pl.deck.slice(0, n)] } : pl,
  ),
});
const OFFERED_LIFE = (offered: string[]) => offered.some((o) => o.includes(LIFE));
const OFFERED_DEATH = (offered: string[]) => offered.some((o) => o.includes(DEATH));

describe("Angel identity registry", () => {
  it.each([LIFE, REGROWTH, DEATH])("%s validates", (id) => {
    expect(validateDefinition(ANGEL_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs, one per face that prints an ability", () => {
    expect(Object.keys(ANGEL_IDENTITY).sort()).toEqual([LIFE, REGROWTH, DEATH].sort());
  });
});

describe("Warren Worthington III: setup and the three faces", () => {
  it("has no Setup: the game starts in alter-ego form, hand size 6, the other 34 cards of the 40 in the deck", () => {
    const s = setupGame();
    expect(formOf(s).form).toBe("alterEgo");
    expect(formOf(s).heroFormIndex).toBeNull();
    expect(handSize(s)).toBe(6);
    expect(deckSize(s)).toBe(34);
    expect(playerOf(s, P1).discard).toHaveLength(0);
    expect(damageOn(s, identityOf(s))).toBe(0);
  });

  it("alter-ego to Angel, to Archangel, and each back to alter-ego, each a single legal change of form", () => {
    for (const [from, to] of [
      [WARREN, ANGEL_FACE],
      [WARREN, ARCHANGEL],
      [ANGEL_FACE, ARCHANGEL],
      [ARCHANGEL, ANGEL_FACE],
    ] as const) {
      const base = inForm(from);
      const r = applyCommand(base, { type: "changeForm", playerId: P1, to }, DEPS);
      expect(r.ok, JSON.stringify([from, to])).toBe(true);
      if (!r.ok) continue;
      expect(formOf(r.state)).toMatchObject({ form: "hero", heroFormIndex: to.heroForm, changedFormThisRound: true });
    }
    for (const from of [ANGEL_FACE, ARCHANGEL] as const) {
      const r = applyCommand(inForm(from), { type: "changeForm", playerId: P1, to: "alterEgo" }, DEPS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(formOf(r.state)).toMatchObject({ form: "alterEgo", heroFormIndex: null });
    }
  });

  it("a bare change from alter-ego names no face and is refused; changing to the face already showing is refused", () => {
    expect(applyCommand(inForm(WARREN), { type: "changeForm", playerId: P1 }, DEPS).ok).toBe(false);
    expect(applyCommand(inForm(ANGEL_FACE), { type: "changeForm", playerId: P1, to: ANGEL_FACE }, DEPS).ok).toBe(false);
    expect(applyCommand(inForm(ARCHANGEL), { type: "changeForm", playerId: P1, to: ARCHANGEL }, DEPS).ok).toBe(false);
    expect(applyCommand(inForm(WARREN), { type: "changeForm", playerId: P1, to: "alterEgo" }, DEPS).ok).toBe(false);
  });

  it("a bare change from a hero face goes to alter-ego (the voluntary command; the effect's prompt is Metamorphosis's)", () => {
    const r = applyCommand(inForm(ANGEL_FACE), { type: "changeForm", playerId: P1 }, DEPS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(formOf(r.state).form).toBe("alterEgo");
  });

  it("form changes are once per round, hero face to hero face included", () => {
    const first = applyCommand(inForm(WARREN), { type: "changeForm", playerId: P1, to: ANGEL_FACE }, DEPS);
    if (!first.ok) throw new Error(first.error.message);
    const second = applyCommand(first.state, { type: "changeForm", playerId: P1, to: ARCHANGEL }, DEPS);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("already_changed_form");
    const back = applyCommand(first.state, { type: "changeForm", playerId: P1, to: "alterEgo" }, DEPS);
    expect(back.ok).toBe(false);
    // Hero face to the other hero face spends the change too.
    const hero = applyCommand(inForm(ANGEL_FACE), { type: "changeForm", playerId: P1, to: ARCHANGEL }, DEPS);
    if (!hero.ok) throw new Error(hero.error.message);
    const again = applyCommand(hero.state, { type: "changeForm", playerId: P1, to: ANGEL_FACE }, DEPS);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("already_changed_form");
  });

  it("each face has its own printed stats: ATK 1 as Angel, 2 as Archangel; THW 2 as Angel, 0 as Archangel", () => {
    const attack = (s: GameState): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s),
      targetInstanceId: stryfe(s),
    });
    const angel = inForm(ANGEL_FACE);
    const archangel = inForm(ARCHANGEL);
    expect(damageOn(driveEventsPicking(DEPS, angel, firstLegal, attack(angel)).state, stryfe(angel))).toBe(1);
    expect(damageOn(driveEventsPicking(DEPS, archangel, firstLegal, attack(archangel)).state, stryfe(archangel))).toBe(
      2,
    );
    const thwart = (s: GameState, scheme: InstanceId): Command => ({
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: scheme,
    });
    const staged = (form: typeof ANGEL_FACE | typeof ARCHANGEL) => encounterCardInVillainArea(inForm(form), "40131", 5);
    const a = staged(ANGEL_FACE);
    const afterAngel = driveEventsPicking(DEPS, a.state, firstLegal, thwart(a.state, a.id)).state;
    expect(inst(afterAngel, a.id).threat).toBe(3);
    const b = staged(ARCHANGEL);
    // THW 0: the thwart is allowed and removes nothing.
    const afterArch = driveEventsPicking(DEPS, b.state, firstLegal, thwart(b.state, b.id)).state;
    expect(inst(afterArch, b.id).threat).toBe(5);
  });
});

describe("Warren Worthington III (42001b): Regrowth", () => {
  const regrow = (s: GameState): Command => use(P1, identityOf(s), REGROWTH);

  it("Action in alter-ego form: heals 1 damage from Warren", () => {
    const base = withDamage(inForm(WARREN), identityOf(inForm(WARREN)), 3);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, regrow(base));
    expect(damageOn(state, identityOf(state))).toBe(2);
  });

  it("is limited to once per round: a second use is refused until the next round", () => {
    const base = withDamage(inForm(WARREN), identityOf(inForm(WARREN)), 3);
    const one = driveEventsPicking(DEPS, base, firstLegal, regrow(base)).state;
    expect(applyCommand(one, regrow(one), DEPS).ok).toBe(false);
    // Spend the round: change to Angel, end the turn, and come back to Warren next round.
    const hero = driveEventsPicking(DEPS, one, firstLegal, { type: "changeForm", playerId: P1, to: ANGEL_FACE }).state;
    const next = settle(
      driveEventsPicking(DEPS, hero, firstLegal, endTurn(P1)).state,
      firstLegal,
      (s) => s.step.phase === "player" && s.round > one.round,
      DEPS,
    );
    expect(next.round).toBe(one.round + 1);
    const alterEgo = driveEventsPicking(DEPS, next, firstLegal, {
      type: "changeForm",
      playerId: P1,
      to: "alterEgo",
    }).state;
    const before = damageOn(alterEgo, identityOf(alterEgo));
    const two = driveEventsPicking(DEPS, alterEgo, firstLegal, regrow(alterEgo)).state;
    expect(damageOn(two, identityOf(two))).toBe(before - 1);
  });

  it("is an alter-ego ability: refused while Angel or Archangel shows", () => {
    for (const form of [ANGEL_FACE, ARCHANGEL] as const) {
      const base = withDamage(inForm(form), identityOf(inForm(form)), 3);
      expect(applyCommand(base, regrow(base), DEPS).ok).toBe(false);
    }
  });

  it("two players: heals only Warren's own player's identity", () => {
    const start = inForm(WARREN, [ANGEL, SPIDER_MAN]);
    const hurt = withDamage(withDamage(start, identityOf(start, P1), 3), identityOf(start, P2), 3);
    const { state } = driveEventsPicking(DEPS, hurt, firstLegal, regrow(hurt));
    expect(damageOn(state, identityOf(state, P1))).toBe(2);
    expect(damageOn(state, identityOf(state, P2))).toBe(3);
  });
});

describe("Angel (42001a): Angel of Life", () => {
  it("after you play an AERIAL event, draw 1 card (the event's own cost paid, then the draw)", () => {
    const base = inForm(ANGEL_FACE);
    const { state, offered, before } = playEvent(base, VIGILANT, 2, accepting(LIFE));
    expect(OFFERED_LIFE(offered)).toBe(true);
    // The event and the 2 cards that paid for it leave the hand; the draw brings 1 back.
    expect(handSize(state)).toBe(before - 3 + 1);
    expect(deckSize(state)).toBe(deckSize(moveToHand(base, P1, VIGILANT).state) - 1);
  });

  it("is optional: declining draws nothing", () => {
    const { state, offered, before } = playEvent(inForm(ANGEL_FACE), VIGILANT, 2, accepting("nothing"));
    expect(OFFERED_LIFE(offered)).toBe(true);
    expect(handSize(state)).toBe(before - 3);
  });

  it("is limited to once per phase: a second AERIAL event the same phase is not offered it", () => {
    const one = playEvent(inForm(ANGEL_FACE), VIGILANT, 2, accepting(LIFE));
    expect(handSize(one.state)).toBe(one.before - 3 + 1);
    const two = playEvent(one.state, RAZOR_DIVE, 3, accepting(LIFE));
    expect(OFFERED_LIFE(two.offered)).toBe(false);
    // The event and its 3 payers leave the hand, and no draw follows.
    expect(handSize(two.state)).toBe(two.before - 4);
  });

  it("is available again in the next round's player phase", () => {
    const one = playEvent(inForm(ANGEL_FACE), VIGILANT, 2, accepting(LIFE)).state;
    const next = settle(
      driveEventsPicking(DEPS, one, firstLegal, endTurn(P1)).state,
      firstLegal,
      (s) => s.step.phase === "player" && s.round > one.round,
      DEPS,
    );
    const { offered } = playEvent(next, VIGILANT, 2, accepting(LIFE));
    expect(OFFERED_LIFE(offered)).toBe(true);
  });

  it("only an AERIAL event: Taunt (TACTIC) does not offer it", () => {
    const { state, offered, before } = playEvent(inForm(ANGEL_FACE), TAUNT, 1, accepting(LIFE));
    expect(offered).toEqual([]);
    expect(handSize(state)).toBe(before - 2);
  });

  it("is a hero-face ability: not offered to Warren or to Archangel when an AERIAL event is played", () => {
    // Ever Vigilant itself says "play only if your identity has the aerial trait", so Warren plays Razor Dive.
    expect(OFFERED_LIFE(playEvent(inForm(WARREN), RAZOR_DIVE, 3, accepting(LIFE)).offered)).toBe(false);
    expect(OFFERED_LIFE(playEvent(inForm(ARCHANGEL), VIGILANT, 2, accepting(LIFE)).offered)).toBe(false);
  });

  it("two players: another player's AERIAL event does not offer it, and the other seat's own does", () => {
    const first = inForm(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const spiderTurn = driveEventsPicking(DEPS, first, firstLegal, endTurn(P1)).state;
    const spiderHero = withForm(spiderTurn, ANGEL_FACE, P2);
    const kick = playEvent(spiderHero, WEB_KICK, 3, accepting(LIFE), P2);
    expect(kick.offered).toEqual([]);
    expect(handSize(kick.state, P1)).toBe(handSize(first, P1));
    // Angel as the second seat: his player draws, nobody else does.
    const second = withForm(inForm(WARREN, [SPIDER_MAN, ANGEL]), ANGEL_FACE, P2);
    const turn = driveEventsPicking(DEPS, second, firstLegal, endTurn(P1)).state;
    const own = playEvent(turn, VIGILANT, 2, accepting(LIFE), P2);
    expect(OFFERED_LIFE(own.offered)).toBe(true);
    expect(handSize(own.state, P2)).toBe(own.before - 3 + 1);
    expect(handSize(own.state, P1)).toBe(handSize(turn, P1));
  });
});

describe("Archangel (42001c): Angel of Death", () => {
  it("after you play an AERIAL event, deals damage to an enemy equal to its printed cost (2 for Ever Vigilant)", () => {
    const base = inForm(ARCHANGEL);
    const { state, offered, before } = playEvent(base, VIGILANT, 2, accepting(DEATH));
    expect(OFFERED_DEATH(offered)).toBe(true);
    expect(damageOn(state, stryfe(base))).toBe(2);
    expect(handSize(state)).toBe(before - 3);
  });

  it("deals 3 for a printed cost 3 event (Razor Dive)", () => {
    const base = inForm(ARCHANGEL);
    const { state } = playEvent(base, RAZOR_DIVE, 3, accepting(DEATH));
    expect(damageOn(state, stryfe(base))).toBe(3);
  });

  it("is optional: declining deals nothing", () => {
    const base = inForm(ARCHANGEL);
    const { state, offered } = playEvent(base, VIGILANT, 2, accepting("nothing"));
    expect(OFFERED_DEATH(offered)).toBe(true);
    expect(damageOn(state, stryfe(base))).toBe(0);
  });

  it("is limited to once per phase", () => {
    const base = inForm(ARCHANGEL);
    const one = playEvent(base, VIGILANT, 2, accepting(DEATH));
    const two = playEvent(one.state, RAZOR_DIVE, 3, accepting(DEATH));
    expect(OFFERED_DEATH(two.offered)).toBe(false);
    expect(damageOn(two.state, stryfe(base))).toBe(2);
  });

  it("only an AERIAL event: Taunt does not offer it; Warren and Angel are not offered it", () => {
    expect(playEvent(inForm(ARCHANGEL), TAUNT, 1, accepting(DEATH)).offered).toEqual([]);
    expect(OFFERED_DEATH(playEvent(inForm(WARREN), RAZOR_DIVE, 3, accepting(DEATH)).offered)).toBe(false);
    expect(OFFERED_DEATH(playEvent(inForm(ANGEL_FACE), VIGILANT, 2, accepting(DEATH)).offered)).toBe(false);
  });

  it("two players: another player's AERIAL event does not offer it", () => {
    const first = inForm(ARCHANGEL, [ANGEL, SPIDER_MAN]);
    const spiderTurn = driveEventsPicking(DEPS, first, firstLegal, endTurn(P1)).state;
    const kick = playEvent(withForm(spiderTurn, ANGEL_FACE, P2), WEB_KICK, 3, accepting(DEATH), P2);
    expect(kick.offered).toEqual([]);
  });
});

describe("the faces' abilities and limits together", () => {
  it("each ability keeps its own once-per-phase limit across a flip (January 26, 2026 - Ruling 6)", () => {
    const base = inForm(ANGEL_FACE);
    const life = playEvent(base, VIGILANT, 2, accepting(LIFE));
    expect(handSize(life.state)).toBe(life.before - 3 + 1);
    // Angel to Archangel (a voluntary change), then another AERIAL event: Angel of Death has its own, unspent limit.
    const flipped = driveEventsPicking(DEPS, life.state, firstLegal, {
      type: "changeForm",
      playerId: P1,
      to: ARCHANGEL,
    }).state;
    const death = playEvent(flipped, RAZOR_DIVE, 3, accepting(DEATH));
    expect(OFFERED_DEATH(death.offered)).toBe(true);
    expect(damageOn(death.state, stryfe(base))).toBe(3);
    // Back to Angel (staged: the round's one change is spent): Angel of Life is still spent this phase.
    const back = topUp(withForm(death.state, ANGEL_FACE), 4);
    const again = playEvent(back, VIGILANT, 2, accepting(LIFE));
    expect(OFFERED_LIFE(again.offered)).toBe(false);
  });

  it("the face showing after the event resolves answers it (Q42): Metamorphosis as Angel into Archangel offers Death, for 2", () => {
    const base = inForm(ANGEL_FACE);
    const { state, offered } = playEvent(base, METAMORPHOSIS, 2, accepting(DEATH));
    expect(formOf(state).heroFormIndex).toBe(1);
    expect(OFFERED_LIFE(offered)).toBe(false);
    expect(OFFERED_DEATH(offered)).toBe(true);
    expect(damageOn(state, stryfe(base))).toBe(2);
    // The change of form was the event's, so the voluntary change of the round is unspent.
    expect(formOf(state).changedFormThisRound).toBe(false);
  });
});

describe("Archangel's acceleration icon", () => {
  /** Ends the turn (and every other seat's) and returns the main scheme's threat after villain phase step one. */
  const stepOne = (start: GameState, seats = 1) => {
    let state = start;
    const placed: { amount: number; sourceInstanceId: unknown }[] = [];
    for (let i = 0; i < seats; i++) {
      const player = i === 0 ? P1 : P2;
      const r = driveEventsPicking(DEPS, state, firstLegal, endTurn(player));
      state = r.state;
      for (const e of r.events)
        if (e.type === "threatPlaced" && e.schemeInstanceId === start.mainScheme.instanceId)
          placed.push({ amount: e.amount, sourceInstanceId: e.sourceInstanceId });
    }
    return { state, placed };
  };

  it("while Archangel shows, step one places 1 more threat (4 in all: 1 from the icon, 3 from the villain phase)", () => {
    const start = inForm(ARCHANGEL);
    expect(mainThreat(start)).toBe(0);
    const { state, placed } = stepOne(start);
    expect(placed[0]).toEqual({ amount: 1, sourceInstanceId: null });
    expect(mainThreat(state)).toBe(4);
  });

  it("while Angel shows there is no icon: 3 threat and no placement from step one", () => {
    const start = inForm(ANGEL_FACE);
    const { state, placed } = stepOne(start);
    expect(placed.some((p) => p.sourceInstanceId === null)).toBe(false);
    expect(mainThreat(state)).toBe(3);
  });

  it("changing from Archangel to Angel takes the icon away, and back again brings it back", () => {
    const toAngel = driveEventsPicking(DEPS, inForm(ARCHANGEL), firstLegal, {
      type: "changeForm",
      playerId: P1,
      to: ANGEL_FACE,
    }).state;
    expect(mainThreat(stepOne(toAngel).state)).toBe(3);
    const toArch = driveEventsPicking(DEPS, inForm(ANGEL_FACE), firstLegal, {
      type: "changeForm",
      playerId: P1,
      to: ARCHANGEL,
    }).state;
    expect(mainThreat(stepOne(toArch).state)).toBe(4);
  });

  it("two players: one icon is one additional threat, not one per player", () => {
    const withArchangel = stepOne(inForm(ARCHANGEL, [ANGEL, SPIDER_MAN]), 2);
    const without = stepOne(inForm(ANGEL_FACE, [ANGEL, SPIDER_MAN]), 2);
    expect(withArchangel.placed.filter((p) => p.sourceInstanceId === null)).toEqual([
      { amount: 1, sourceInstanceId: null },
    ]);
    expect(mainThreat(withArchangel.state) - mainThreat(without.state)).toBe(1);
  });
});
