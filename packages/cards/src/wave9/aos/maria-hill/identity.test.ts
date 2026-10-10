import { AOS_CARDS, WAVE9_STARTER_DECKS, cardId, type HeroIdentityCard } from "@mc/content";
import { applyCommand, handSize, maxHitPoints, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { MARIA_DEPS, inPlay, mariaGame, mariaHeroGame } from "./testing.js";
import { MARIA_HILL_IDENTITY, MARIA_HILL_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Maria Hill (50001a hero / 50001b alter ego), docs/phase7-wave9.md section 8.4, 3.6, 3.10. The printed precon
 * `maria-hill-leadership` (40 cards) against Rhino. Hero face: THW 2, ATK 1, DEF 2, hand size 5, 9 hit points;
 * alter-ego face: REC 3, hand size 6.
 *
 * The supports that hold counters are staged straight into play (the pack's support module is separate work), so they
 * carry no abilities: only the counters move.
 */
const CONSTANT = "50001a.maria-hill-constant";
const REASSIGNMENT = "50001a.reassignment";
const ALTER_CONSTANT = "50001b.maria-hill-constant";
const SEARCH = "50001b.maria-hill-action";

const STAFF = "50008"; // Support Staff, uses 3 staff
const ILIAD = "50009"; // The Iliad, uses 3 mission
const COMMAND_TEAM = "50016"; // uses 3 command
const CIRCE = "50017"; // uses 2 deploy
const FRONT_ORG = "50028"; // basic support, not S.H.I.E.L.D.

const IDENTITY = AOS_CARDS.find((c) => c.id === cardId("50001a")) as HeroIdentityCard;
const PRECON = WAVE9_STARTER_DECKS.find((d) => d.id === "maria-hill-leadership")!;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const counters = (s: GameState, id: InstanceId) => inst(s, id).counters;
const inPlayArea = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).playArea.includes(id);
const inDiscard = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).discard.includes(id);

/** Answers each target prompt with the next named instance (source first, then destination), others by default. */
const choosing = (...ids: readonly InstanceId[]): Picker => {
  let next = 0;
  return (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTarget" && next < ids.length) return [ids[next++]!];
    return firstLegal(s);
  };
};

/** Two S.H.I.E.L.D. supports in play with counters, in hero form. */
function staged(
  a: { code: string; counters: Record<string, number> },
  b: { code: string; counters: Record<string, number> },
) {
  const first = inPlay(mariaHeroGame(), a.code, a.counters);
  const second = inPlay(first.state, b.code, b.counters);
  return { state: second.state, a: first.id, b: second.id };
}

const reassign = (s: GameState, ...picks: readonly InstanceId[]): GameState =>
  settle(runWith(MARIA_DEPS, s, use(P1, identityOf(s), REASSIGNMENT)), choosing(...picks), undefined, MARIA_DEPS);

describe("Maria Hill registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(MARIA_HILL_IDENTITY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it(`${REASSIGNMENT} is an action, limit once per round, no cost`, () => {
    const def = MARIA_HILL_IDENTITY[REASSIGNMENT]!;
    expect(def.trigger).toMatchObject({ kind: "action" });
    expect(def.limit).toEqual({ count: 1, period: "round" });
    expect(def.cost).toBeUndefined();
  });
  it(`${SEARCH} is an action exhausting the identity`, () => {
    const def = MARIA_HILL_IDENTITY[SEARCH]!;
    expect(def.trigger).toMatchObject({ kind: "action" });
    expect(def.cost).toEqual({ exhaustIdentity: true });
  });
  it("all four printed refs are registered; the deck-building rule is an empty constant the engine's deck check covers", () => {
    expect(Object.keys(MARIA_HILL_IDENTITY).sort()).toEqual([ALTER_CONSTANT, CONSTANT, REASSIGNMENT, SEARCH].sort());
    expect(Object.keys(MARIA_HILL_IDENTITY_SKIPPED)).toEqual([]);
    expect(MARIA_HILL_IDENTITY[ALTER_CONSTANT]).toEqual({ trigger: { kind: "constant" }, effects: [] });
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([ALTER_CONSTANT, CONSTANT, REASSIGNMENT, SEARCH].sort());
  });
  it("the deck-building rule is card data: exactly 3 off-aspect S.H.I.E.L.D. support titles", () => {
    expect(IDENTITY.deckbuilding?.offAspectPackages).toEqual([
      { cardType: "support", trait: IDENTITY.hero.traits[0], titles: 3 },
    ]);
  });
});

describe("printed data and setup", () => {
  it("hero face: S.H.I.E.L.D. and SPY, ATK 1, THW 2, DEF 2, hand size 5, 9 hit points", () => {
    expect(IDENTITY.hero.traits.map(String)).toEqual(["S.H.I.E.L.D.", "SPY"]);
    expect([IDENTITY.hero.atk, IDENTITY.hero.thw, IDENTITY.hero.def]).toEqual([1, 2, 2]);
    expect(IDENTITY.hero.handSize).toBe(5);
    expect(IDENTITY.hp).toBe(9);
  });
  it("alter-ego face: S.H.I.E.L.D. and SPY, REC 3, hand size 6", () => {
    expect(IDENTITY.alterEgo.traits.map(String)).toEqual(["S.H.I.E.L.D.", "SPY"]);
    expect(IDENTITY.alterEgo.rec).toBe(3);
    expect(IDENTITY.alterEgo.handSize).toBe(6);
  });
  it("the precon is 40 cards: Maria starts as her alter ego with a hand of 6 and a 34-card deck", () => {
    expect(PRECON.cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    const s = mariaGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, MARIA_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), MARIA_DEPS)).toBe(9);
  });
  it("hero form: hand size 5", () => {
    expect(handSize(mariaHeroGame(), P1, MARIA_DEPS)).toBe(5);
  });
});

describe(`${CONSTANT}: each ally you control gains the S.H.I.E.L.D. trait`, () => {
  const BLACK_CAT = "01002"; // a Core ally with no S.H.I.E.L.D. trait
  const SWAP = { "50013": BLACK_CAT } as const;
  const shield = (s: GameState, id: InstanceId): boolean =>
    traitsOf(s, id, MARIA_DEPS).map(String).includes("S.H.I.E.L.D.");

  it("an ally without the trait gains it in hero form", () => {
    const hero = inPlay(mariaHeroGame(1, SWAP), BLACK_CAT);
    expect(shield(hero.state, hero.id)).toBe(true);
  });
  it("the ability is printed on the hero face only: in alter-ego form the ally does not gain it", () => {
    const ego = inPlay(mariaGame(1, SWAP), BLACK_CAT);
    expect(shield(ego.state, ego.id)).toBe(false);
  });
  it("a printed S.H.I.E.L.D. ally keeps it", () => {
    const grant = inPlay(mariaHeroGame(), "50012");
    expect(shield(grant.state, grant.id)).toBe(true);
  });
  it("only allies: a support without the trait does not gain it", () => {
    const front = inPlay(mariaHeroGame(), FRONT_ORG);
    expect(shield(front.state, front.id)).toBe(false);
  });
});

describe(`${REASSIGNMENT}: move 1 all-purpose counter between S.H.I.E.L.D. supports`, () => {
  it("The Iliad (3 mission) and Support Staff (3 staff): 1 staff counter moves to The Iliad, retyped as mission", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: STAFF, counters: { staff: 3 } });
    const after = reassign(state, b, a);
    expect(counters(after, a)).toEqual({ mission: 4 });
    expect(counters(after, b)).toEqual({ staff: 2 });
    expect(inPlayArea(after, b)).toBe(true);
  });
  it("the other direction: a mission counter becomes a staff counter (Iliad 2, Staff 4)", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: STAFF, counters: { staff: 3 } });
    const after = reassign(state, a, b);
    expect(counters(after, a)).toEqual({ mission: 2 });
    expect(counters(after, b)).toEqual({ staff: 4 });
  });
  it("only 1 counter moves, whatever the stack holds", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 2 } }, { code: CIRCE, counters: { deploy: 2 } });
    const after = reassign(state, a, b);
    expect(counters(after, a).mission).toBe(1);
    expect(counters(after, b).deploy).toBe(3);
  });
  it("no threat, damage or card movement besides the counter: hands and discard are untouched", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: STAFF, counters: { staff: 3 } });
    const after = reassign(state, a, b);
    expect(playerOf(after, P1).hand).toEqual(playerOf(state, P1).hand);
    expect(playerOf(after, P1).discard).toEqual(playerOf(state, P1).discard);
  });
  it("a support with no counters is not offered as the source", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: {} }, { code: STAFF, counters: { staff: 3 } });
    const asked = runWith(MARIA_DEPS, state, use(P1, identityOf(state), REASSIGNMENT));
    const options = asked.pendingChoice!.options.map((o) => o.optionId);
    expect(options).toEqual([b]);
    expect(options).not.toContain(a);
  });
  it("the destination must be a different support: the source is not offered again", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: STAFF, counters: { staff: 3 } });
    const second = settle(
      runWith(MARIA_DEPS, state, use(P1, identityOf(state), REASSIGNMENT)),
      (s) => (s.pendingChoice!.options.length > 0 ? [a] : firstLegal(s)),
      (s) => s.pendingChoice?.options.some((o) => o.optionId === b) === true && s.pendingChoice.options.length === 1,
      MARIA_DEPS,
    );
    expect(second.pendingChoice!.options.map((o) => o.optionId)).toEqual([b]);
  });
  it("a support that is not S.H.I.E.L.D. is no source and no destination", () => {
    const front = inPlay(mariaHeroGame(), FRONT_ORG, { staff: 1 });
    const iliad = inPlay(front.state, ILIAD, { mission: 3 });
    // With The Iliad the only S.H.I.E.L.D. support, there is no second one for a destination: nothing to do.
    expect(applyCommand(iliad.state, use(P1, identityOf(iliad.state), REASSIGNMENT), MARIA_DEPS).ok).toBe(false);
    expect(counters(iliad.state, front.id)).toEqual({ staff: 1 });
  });
  it("a lone S.H.I.E.L.D. support cannot be both: the action is not available and nothing is spent", () => {
    const only = inPlay(mariaHeroGame(), ILIAD, { mission: 3 });
    expect(applyCommand(only.state, use(P1, identityOf(only.state), REASSIGNMENT), MARIA_DEPS).ok).toBe(false);
  });
  it("no support holds a counter: the action cannot be used", () => {
    const { state } = staged({ code: ILIAD, counters: {} }, { code: STAFF, counters: {} });
    expect(applyCommand(state, use(P1, identityOf(state), REASSIGNMENT), MARIA_DEPS).ok).toBe(false);
  });
  it("Command Team's last command counter moves away: Command Team is discarded (Uses, RRG 1.8 p. 46)", () => {
    const { state, a, b } = staged(
      { code: COMMAND_TEAM, counters: { command: 1 } },
      { code: ILIAD, counters: { mission: 3 } },
    );
    const after = reassign(state, a, b);
    expect(counters(after, b)).toEqual({ mission: 4 });
    expect(inPlayArea(after, a)).toBe(false);
    expect(inDiscard(after, a)).toBe(true);
  });
  it("a uses support left with counters stays in play (Command Team 2 to 1)", () => {
    const { state, a, b } = staged(
      { code: COMMAND_TEAM, counters: { command: 2 } },
      { code: ILIAD, counters: { mission: 3 } },
    );
    const after = reassign(state, a, b);
    expect(counters(after, a)).toEqual({ command: 1 });
    expect(inPlayArea(after, a)).toBe(true);
  });
  it("a destination uses support gains the counter above its printed Uses (Iliad 3 to 4 is allowed)", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: CIRCE, counters: { deploy: 1 } });
    const after = reassign(state, b, a);
    expect(counters(after, a).mission).toBe(4);
    expect(inDiscard(after, b)).toBe(true);
  });
  it("Limit once per round: refused a second time in the round, usable again next round", () => {
    const { state, a, b } = staged({ code: ILIAD, counters: { mission: 3 } }, { code: STAFF, counters: { staff: 3 } });
    const once = reassign(state, a, b);
    const again = applyCommand(once, use(P1, identityOf(once), REASSIGNMENT), MARIA_DEPS);
    expect(again.ok).toBe(false);
    expect(counters(once, a)).toEqual({ mission: 2 });
    expect(counters(once, b)).toEqual({ staff: 4 });
    const next = settle(
      runWith(MARIA_DEPS, once, endTurn(P1)),
      firstLegal,
      (s) => s.step.phase === "player" && s.round > once.round,
      MARIA_DEPS,
    );
    expect(next.round).toBeGreaterThan(once.round);
    expect(applyCommand(next, use(P1, identityOf(next), REASSIGNMENT), MARIA_DEPS).ok).toBe(true);
  });
  it("is an action of the hero face: not available in alter-ego form", () => {
    const first = inPlay(mariaGame(), ILIAD, { mission: 3 });
    const both = inPlay(first.state, STAFF, { staff: 3 });
    expect(applyCommand(both.state, use(P1, identityOf(both.state), REASSIGNMENT), MARIA_DEPS).ok).toBe(false);
  });
});

describe(`${SEARCH}: exhaust Maria Hill, search your deck for a S.H.I.E.L.D. support, add it to your hand`, () => {
  const supportsIn = (s: GameState, zone: "deck" | "hand"): string[] =>
    playerOf(s, P1)
      [zone].map((id) => codeOf(s, id))
      .filter((c) => ["50008", "50009", "50016", "50017", "50018", "50019", "50020"].includes(c));
  const chosen =
    (code: string): Picker =>
    (s) => {
      const o = s.pendingChoice!.options.find((x) => codeOf(s, x.optionId as InstanceId) === code);
      return o ? [o.optionId] : firstLegal(s);
    };

  it("adds the chosen support to hand, exhausts Maria, and the deck is one card smaller", () => {
    const s = mariaGame();
    const wanted = supportsIn(s, "deck")[0]!;
    const handBefore = playerOf(s, P1).hand.length;
    const deckBefore = playerOf(s, P1).deck.length;
    const after = settle(runWith(MARIA_DEPS, s, use(P1, identityOf(s), SEARCH)), chosen(wanted), undefined, MARIA_DEPS);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).toHaveLength(handBefore + 1);
    expect(playerOf(after, P1).deck).toHaveLength(deckBefore - 1);
    expect(codeOf(after, playerOf(after, P1).hand.at(-1)!)).toBe(wanted);
  });
  it("offers only S.H.I.E.L.D. supports: no ally, upgrade or non-S.H.I.E.L.D. support", () => {
    const s = mariaGame();
    const asked = runWith(MARIA_DEPS, s, use(P1, identityOf(s), SEARCH));
    const codes = asked.pendingChoice!.options.map((o) => codeOf(asked, o.optionId as InstanceId));
    for (const c of codes) expect(["50008", "50009", "50016", "50017", "50018", "50019", "50020"]).toContain(c);
    expect(codes).not.toContain(FRONT_ORG);
  });
  it("the deck is shuffled afterward (the draw order changes) and no other card leaves it", () => {
    const s = mariaGame();
    const wanted = supportsIn(s, "deck")[0]!;
    const before = [...playerOf(s, P1).deck];
    const after = settle(runWith(MARIA_DEPS, s, use(P1, identityOf(s), SEARCH)), chosen(wanted), undefined, MARIA_DEPS);
    const kept = playerOf(after, P1).deck;
    expect([...kept].sort()).toEqual(before.filter((id) => !playerOf(after, P1).hand.includes(id)).sort());
  });
  it("search miss: with no S.H.I.E.L.D. support left in the deck Maria still exhausts and nothing is added", () => {
    const base = mariaGame();
    const bare = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        deck: p.deck.filter(
          (id) => !["50008", "50009", "50016", "50017", "50018", "50019", "50020"].includes(codeOf(base, id)),
        ),
      })),
    };
    const deckBefore = playerOf(bare, P1).deck.length;
    const after = settle(
      runWith(MARIA_DEPS, bare, use(P1, identityOf(bare), SEARCH)),
      firstLegal,
      undefined,
      MARIA_DEPS,
    );
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).toHaveLength(playerOf(bare, P1).hand.length);
    expect(playerOf(after, P1).deck).toHaveLength(deckBefore);
  });
  it("cannot be used with Maria exhausted", () => {
    const s = patchInstance(mariaGame(), identityOf(mariaGame()), { exhausted: true });
    expect(applyCommand(s, use(P1, identityOf(s), SEARCH), MARIA_DEPS).ok).toBe(false);
  });
  it("is an alter-ego face ability: not available in hero form", () => {
    const s = mariaHeroGame();
    expect(applyCommand(s, use(P1, identityOf(s), SEARCH), MARIA_DEPS).ok).toBe(false);
  });
});
