import { AOS_CARDS, cardId, trait, type HeroIdentityCard } from "@mc/content";
import {
  handSize,
  legalActions,
  maxHitPoints,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { FURY_DEPS, furyGame, furyHeroGame, suitOf } from "./testing.js";
import { NICK_FURY_IDENTITY, NICK_FURY_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nick Fury (50034a/b), docs/phase7-wave9.md section 8.4, 3.7, 3.8. The printed precon `nick-fury-justice` against
 * Rhino. Hero face: ATK 2, THW 2, DEF 2, hand size 5, 10 hit points; alter-ego face: REC 4, hand size 6. Assault /
 * Stealth (50035a/b) is scripted by another module, so its own interrupt and Stealth's forced interrupt are not live
 * here; what is asserted is the threat it holds and the face it shows.
 */
const GATHER_INTEL = "50034a.star-gather-intel";
const BREAK_COVER = "50034a.break-cover";
const SUIT_UP = "50034b.suit-up";
const INFILTRATE = "50034b.infiltrate";
const HAYMAKER = "01087";

const IDENTITY = AOS_CARDS.find((c) => c.id === cardId("50034a")) as HeroIdentityCard;

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const withScheme = (s: GameState, threat: number): GameState => patchInstance(s, schemeOf(s), { threat });
const suitThreat = (s: GameState): number => inst(s, suitOf(s)!).threat;
const showsStealth = (s: GameState): boolean => inst(s, suitOf(s)!).flipped;
const withSuit = (s: GameState, patch: { threat?: number; flipped?: boolean }): GameState =>
  patchInstance(s, suitOf(s)!, patch);
const formChanges = (events: readonly GameEvent[]) => events.filter((e) => e.type === "additionalFormChanged");

const thwart = (s: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: schemeOf(s),
});
const attack = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: villainOf(s),
});

/** Takes Gather Intel when it is offered, otherwise answers like `firstLegal`; the defender is always the hero. */
const takeIntel =
  (take = true): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      const mine = choice.options.find((o) => o.optionId.endsWith(GATHER_INTEL));
      return mine && take ? [mine.optionId] : firstLegal(s);
    }
    if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
    return firstLegal(s);
  };

describe("Nick Fury identity registry", () => {
  it("every ability validates, with the printed timing", () => {
    for (const id of [GATHER_INTEL, BREAK_COVER, SUIT_UP, INFILTRATE]) {
      expect(validateDefinition(NICK_FURY_IDENTITY[id]!), id).toEqual([]);
    }
    expect(NICK_FURY_IDENTITY[GATHER_INTEL]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(NICK_FURY_IDENTITY[BREAK_COVER]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(NICK_FURY_IDENTITY[SUIT_UP]!.trigger).toMatchObject({ kind: "setup" });
    expect(NICK_FURY_IDENTITY[INFILTRATE]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(NICK_FURY_IDENTITY[INFILTRATE]!.cost).toBeUndefined();
    expect(NICK_FURY_IDENTITY[INFILTRATE]!.limit).toBeUndefined();
  });
  it("all four printed refs are registered and none is skipped", () => {
    expect(NICK_FURY_IDENTITY_SKIPPED).toEqual({});
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([BREAK_COVER, GATHER_INTEL, INFILTRATE, SUIT_UP].sort());
    expect(Object.keys(NICK_FURY_IDENTITY).sort()).toEqual(printed.sort());
  });
});

describe("printed stats, read from the game", () => {
  it("data: hero ATK 2, THW 2, DEF 2, hand size 5, 10 hit points; alter ego REC 4, hand size 6; traits", () => {
    expect(IDENTITY.hp).toBe(10);
    expect(IDENTITY.hero).toMatchObject({ atk: 2, thw: 2, def: 2, handSize: 5 });
    expect(IDENTITY.alterEgo).toMatchObject({ rec: 4, handSize: 6 });
    const traits = [trait("S.H.I.E.L.D."), trait("SOLDIER"), trait("SPY")];
    expect(IDENTITY.hero.traits).toEqual(traits);
    expect(IDENTITY.alterEgo.traits).toEqual(traits);
    expect(IDENTITY.unique).toBe(true);
  });
  it("starts in alter-ego form with a hand of 6 and a 34-card deck, 10 hit points", () => {
    const s = furyGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, FURY_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), FURY_DEPS)).toBe(10);
  });
  it("REC 4: recovering from 6 damage leaves 2", () => {
    const hurt = withDamage(furyGame(), identityOf(furyGame()), 6);
    const after = settle(
      runWith(FURY_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      firstLegal,
      undefined,
      FURY_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("hero form: hand size 5; THW 2 takes the scheme from 5 to 3; ATK 2 deals 2 damage", () => {
    const s = withScheme(furyHeroGame(), 5);
    expect(handSize(s, P1, FURY_DEPS)).toBe(5);
    const thwarted = driveEventsPicking(FURY_DEPS, s, takeIntel(false), thwart(s)).state;
    expect(inst(thwarted, schemeOf(thwarted)).threat).toBe(3);
    const hit = driveEventsPicking(FURY_DEPS, s, takeIntel(false), attack(s)).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(2);
  });
});

describe(`${SUIT_UP}: Setup puts your suit form upgrade into play, Assault side faceup`, () => {
  it("Assault 50035a is in play attached to the identity, front face showing, with no threat", () => {
    const s = furyGame();
    const suit = suitOf(s);
    expect(suit).toBeDefined();
    expect(inst(s, suit!).attachedTo).toBe(identityOf(s));
    expect(inst(s, suit!).faceup).toBe(true);
    expect(showsStealth(s)).toBe(false);
    expect(suitThreat(s)).toBe(0);
  });
  it("it is outside the 40 counted cards: exactly one copy, none in hand, deck or discard", () => {
    const s = furyGame();
    const copies = Object.values(s.instances).filter((i) => (i.cardId as string) === "50035a");
    expect(copies).toHaveLength(1);
    const player = playerOf(s, P1);
    const elsewhere = [...player.hand, ...player.deck, ...player.discard].filter(
      (id) => (inst(s, id).cardId as string) === "50035a",
    );
    expect(elsewhere).toEqual([]);
  });
});

describe(`${INFILTRATE}: Action: change to Stealth suit form`, () => {
  it("flips the suit to Stealth, announces the change, and leaves Fury in alter-ego form", () => {
    const s = furyGame();
    const { state, events } = driveEventsPicking(FURY_DEPS, s, firstLegal, use(P1, identityOf(s), INFILTRATE));
    expect(showsStealth(state)).toBe(true);
    expect(formChanges(events)).toMatchObject([{ formType: "suit", formName: "Stealth" }]);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
  });
  it("is not the once-per-turn identity flip: Fury can still change to hero form afterwards", () => {
    const s = furyGame();
    const { state } = driveEventsPicking(FURY_DEPS, s, firstLegal, use(P1, identityOf(s), INFILTRATE));
    const legal = legalActions(state, P1, FURY_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "changeForm")).toBe(true);
  });
  it("with Stealth already showing nothing changes and nothing is announced", () => {
    const s = withSuit(furyGame(), { flipped: true });
    const { state, events } = driveEventsPicking(FURY_DEPS, s, firstLegal, use(P1, identityOf(s), INFILTRATE));
    expect(showsStealth(state)).toBe(true);
    expect(formChanges(events)).toEqual([]);
  });
  it("keeps the threat on the suit through the change", () => {
    const s = withSuit(furyGame(), { threat: 4 });
    const { state } = driveEventsPicking(FURY_DEPS, s, firstLegal, use(P1, identityOf(s), INFILTRATE));
    expect(showsStealth(state)).toBe(true);
    expect(suitThreat(state)).toBe(4);
  });
  it("is an alter-ego action: not offered in hero form", () => {
    const s = furyHeroGame();
    const legal = legalActions(s, P1, FURY_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === INFILTRATE)).toBe(false);
  });
});

describe(`${GATHER_INTEL}: after Nick Fury makes a basic thwart, place 1 threat on your suit form upgrade`, () => {
  it("a basic thwart from 5: the scheme is at 3 and the suit holds 1 threat", () => {
    const s = withScheme(furyHeroGame(), 5);
    const { state } = driveEventsPicking(FURY_DEPS, s, takeIntel(), thwart(s));
    expect(inst(state, schemeOf(state)).threat).toBe(3);
    expect(suitThreat(state)).toBe(1);
    expect(state.pendingChoice).toBeNull();
  });
  it("it is a response the player may decline: declined, the suit holds 0", () => {
    const s = withScheme(furyHeroGame(), 5);
    const { state } = driveEventsPicking(FURY_DEPS, s, takeIntel(false), thwart(s));
    expect(inst(state, schemeOf(state)).threat).toBe(3);
    expect(suitThreat(state)).toBe(0);
  });
  it("each basic thwart places 1 more: two thwarts leave the suit at 3 with Stealth showing", () => {
    let s = withSuit(withScheme(furyHeroGame(), 9), { flipped: true, threat: 1 });
    s = driveEventsPicking(FURY_DEPS, s, takeIntel(), thwart(s)).state;
    expect(suitThreat(s)).toBe(2);
    expect(showsStealth(s)).toBe(true);
  });
  it("a basic attack does not offer it", () => {
    const s = furyHeroGame();
    const offered: string[] = [];
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") offered.push(...choice.options.map((o) => o.optionId));
      return takeIntel()(st);
    };
    const { state } = driveEventsPicking(FURY_DEPS, s, pick, attack(s));
    expect(offered.filter((o) => o.endsWith(GATHER_INTEL))).toEqual([]);
    expect(suitThreat(state)).toBe(0);
  });
});

describe(`${BREAK_COVER}: Forced Interrupt: when you attack, change to Assault suit form`, () => {
  it("in Stealth with 4 threat, a basic attack turns Assault faceup, keeps the 4 threat and still deals 2", () => {
    const s = withSuit(furyHeroGame(), { flipped: true, threat: 4 });
    const { state, events } = driveEventsPicking(FURY_DEPS, s, takeIntel(), attack(s));
    expect(showsStealth(state)).toBe(false);
    expect(suitThreat(state)).toBe(4);
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(formChanges(events)).toMatchObject([{ formType: "suit", formName: "Assault" }]);
  });
  it("it is forced: no prompt asks whether to use it", () => {
    const s = withSuit(furyHeroGame(), { flipped: true });
    const asked: string[] = [];
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") asked.push(...choice.options.map((o) => o.optionId));
      return takeIntel()(st);
    };
    const { state } = driveEventsPicking(FURY_DEPS, s, pick, attack(s));
    expect(asked.filter((o) => o.endsWith(BREAK_COVER))).toEqual([]);
    expect(showsStealth(state)).toBe(false);
  });
  it("already in Assault, a second attack changes nothing and announces nothing", () => {
    const s = furyHeroGame();
    const first = driveEventsPicking(FURY_DEPS, s, takeIntel(), attack(s));
    expect(formChanges(first.events)).toEqual([]);
    expect(showsStealth(first.state)).toBe(false);
  });
  it("an attack event also breaks cover: Haymaker (3 damage) from Stealth turns Assault faceup", () => {
    const base = withSuit(furyHeroGame({ swap: { "50049": HAYMAKER } }), { flipped: true, threat: 2 });
    const given = moveToHand(base, P1, HAYMAKER);
    const card = given.ids[0]!;
    const pay = payWith(given.state, P1, 2, [card]);
    const pick: Picker = (st) =>
      st.pendingChoice!.prompt.kind === "declareDefender" ? [identityOf(st)] : firstLegal(st);
    const { state, events } = driveEventsPicking(FURY_DEPS, given.state, pick, play(P1, card, pay));
    expect(showsStealth(state)).toBe(false);
    expect(suitThreat(state)).toBe(2);
    expect(formChanges(events)).toMatchObject([{ formName: "Assault" }]);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });
});
