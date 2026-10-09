import { BP_CARDS, WAVE9_STARTER_DECKS, cardId, type HeroIdentityCard } from "@mc/content";
import { handSize, maxHitPoints, requiredIdentitySet, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
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
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { BP_DEPS, bpGame, bpHeroGame } from "../testing.js";
import { BLACK_PANTHER_IDENTITY, BLACK_PANTHER_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Panther / Shuri (51001a/b), docs/phase7-wave9.md section 8.4, 3.36, 3.37. The printed precon `bp-justice` (40
 * cards) against Rhino. Hero face: THW 2, ATK 1, DEF 2, hand size 5, 11 hit points; alter-ego face: REC 4, hand size 6.
 *
 * The pack's upgrades are other modules' work, so the Specials here belong to two Core Black Panther upgrades swapped
 * into the precon in place of two aspect cards (deck legality is not checked for that game): Tactical Genius 01048 (thwart 1, 2 as the final step) and
 * Panther Claws 01047 (attack 2, 4 as the final step). Both are on the hero's own set, with the "Black Panther" trait.
 */
const RESPONSE = "51001a.black-panther-response";
const INVENTOR = "51001b.inventor";
const GENIUS = "01048";
const CLAWS = "01047";

const SWAP = { "51015": GENIUS, "51019": CLAWS } as const;
const SCHEME_THREAT = 5;

const PRECON = WAVE9_STARTER_DECKS.find((d) => d.id === "bp-justice")!;
const IDENTITY = BP_CARDS.find((c) => c.id === cardId("51001a")) as HeroIdentityCard;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const offeredResponse = (s: GameState): boolean =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" &&
  s.pendingChoice.options.some((o) => o.optionId.endsWith(RESPONSE));

/** Hero form, a main scheme at 5 threat, and these upgrades (by code) put into play at their printed cost. */
function withUpgrades(...codes: readonly string[]): GameState {
  let state = patchInstance(bpHeroGame({ swap: SWAP }), schemeOf(bpHeroGame({ swap: SWAP })), {
    threat: SCHEME_THREAT,
  });
  for (const code of codes) {
    const given = moveToHand(state, P1, code);
    const upgrade = given.ids[0]!;
    const played = runWith(BP_DEPS, given.state, play(P1, upgrade, payWith(given.state, P1, 2, [upgrade])));
    state = settle(played, firstLegal, undefined, BP_DEPS);
    expect(inst(state, upgrade).attachedTo, `${code} attached`).toBe(identityOf(state));
  }
  return state;
}

/** Takes the response when offered, picks the upgrade named by `special` when asked which, otherwise declines. */
const takeResponse =
  (special?: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      const mine = choice.options.find((o) => o.optionId.endsWith(RESPONSE));
      return mine ? [mine.optionId] : firstLegal(s);
    }
    if (choice.prompt.kind === "chooseTarget" && special) {
      const wanted = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === special);
      if (wanted) return [wanted.optionId];
    }
    if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
    return firstLegal(s);
  };
const declineResponse: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s);

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

describe("Black Panther identity registry", () => {
  it(`${RESPONSE} validates`, () => {
    expect(validateDefinition(BLACK_PANTHER_IDENTITY[RESPONSE]!)).toEqual([]);
  });
  it(`${RESPONSE} is an optional response, the only ref registered`, () => {
    expect(Object.keys(BLACK_PANTHER_IDENTITY)).toEqual([RESPONSE]);
    expect(BLACK_PANTHER_IDENTITY[RESPONSE]!.trigger).toMatchObject({ kind: "response", forced: false });
  });
  it(`${INVENTOR} is skipped with a reason, and is the only ref of the card left out`, () => {
    expect(Object.keys(BLACK_PANTHER_IDENTITY_SKIPPED)).toEqual([INVENTOR]);
    expect(BLACK_PANTHER_IDENTITY_SKIPPED[INVENTOR]).toMatch(/builder/);
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([INVENTOR, RESPONSE].sort());
  });
});

describe("deck builder start state", () => {
  it("requiredIdentitySet is exactly the precon's 15 Black Panther hero cards with their printed quantities", () => {
    const required = requiredIdentitySet(IDENTITY, BP_CARDS);
    const asPairs = required.map((r) => [r.cardId as string, r.quantity] as const);
    expect(asPairs).toEqual([
      ["51002", 1],
      ["51003", 2],
      ["51004", 2],
      ["51005", 1],
      ["51006", 2],
      ["51007", 1],
      ["51008", 1],
      ["51009", 1],
      ["51010", 1],
      ["51011", 1],
      ["51012", 1],
      ["51013", 1],
    ]);
    expect(required.reduce((n, r) => n + r.quantity, 0)).toBe(15);
    const inPrecon = PRECON.cards.filter(
      (l) => (BP_CARDS.find((c) => c.id === l.cardId) as { aspect?: string }).aspect === "hero:51001a",
    );
    expect(asPairs).toEqual(inPrecon.map((l) => [l.cardId as string, l.quantity] as const));
  });
});

describe("setup and printed stats, read from the game", () => {
  it("the precon is 40 cards: Shuri starts with a hand of 6 and a 34-card deck", () => {
    expect(PRECON.cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    const s = bpGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, BP_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), BP_DEPS)).toBe(11);
  });
  it("Shuri REC 4: recovering from 6 damage leaves 2", () => {
    const hurt = withDamage(bpGame(), identityOf(bpGame()), 6);
    const after = settle(
      runWith(BP_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      firstLegal,
      undefined,
      BP_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("Black Panther: hand size 5, 11 hit points, THW 2 (5 threat to 3) and ATK 1 (1 damage), with nothing in play to answer", () => {
    const s = patchInstance(bpHeroGame(), bpHeroGame().mainScheme.instanceId, { threat: SCHEME_THREAT });
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(handSize(s, P1, BP_DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), BP_DEPS)).toBe(11);
    const thwarted = driveEventsPicking(BP_DEPS, s, takeResponse(), thwart(s)).state;
    expect(threat(thwarted)).toBe(3);
    expect(thwarted.pendingChoice).toBeNull();
    const hit = driveEventsPicking(BP_DEPS, bpHeroGame(), takeResponse(), attack(bpHeroGame())).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(1);
  });
});

describe(`${RESPONSE}: after Black Panther uses a basic power, resolve a Special on 1 Black Panther upgrade you control`, () => {
  it("after a basic thwart, Tactical Genius' Special removes 2 more (final step): 5 threat to 3 to 1", () => {
    const s = withUpgrades(GENIUS);
    const { state } = driveEventsPicking(BP_DEPS, s, takeResponse(), thwart(s));
    expect(threat(state)).toBe(1);
    expect(state.pendingChoice).toBeNull();
  });
  it("it is offered after the thwart, and declining it leaves only the basic thwart's 2", () => {
    const s = withUpgrades(GENIUS);
    const asked = settle(runWith(BP_DEPS, s, thwart(s)), firstLegal, offeredResponse, BP_DEPS);
    expect(offeredResponse(asked)).toBe(true);
    const { state } = driveEventsPicking(BP_DEPS, s, declineResponse, thwart(s));
    expect(threat(state)).toBe(3);
  });
  it("after a basic attack, Panther Claws' Special deals 4 (final step) to an enemy: 1 + 4 = 5 on the villain", () => {
    const s = withUpgrades(CLAWS);
    const { state } = driveEventsPicking(BP_DEPS, s, takeResponse(), attack(s));
    expect(inst(state, villainOf(state)).damage).toBe(5);
  });
  it("with two Black Panther upgrades the player chooses which Special resolves; only that one does", () => {
    const s = withUpgrades(GENIUS, CLAWS);
    const claws = driveEventsPicking(BP_DEPS, s, takeResponse(CLAWS), attack(s)).state;
    expect(inst(claws, villainOf(claws)).damage).toBe(5);
    expect(threat(claws)).toBe(SCHEME_THREAT);
    const genius = driveEventsPicking(BP_DEPS, s, takeResponse(GENIUS), attack(s)).state;
    expect(inst(genius, villainOf(genius)).damage).toBe(1);
    expect(threat(genius)).toBe(SCHEME_THREAT - 2);
  });
  it("after his basic defense against Rhino, Genius' Special removes 2 threat from the main scheme", () => {
    const s = withUpgrades(GENIUS);
    const { state: ended, events } = driveEventsPicking(BP_DEPS, s, takeResponse(), endTurn(P1));
    expect(events.some((e) => e.type === "defenderDeclared")).toBe(true);
    // The villain phase adds threat as well: only a response that fired lowers it below the 5 it started at.
    const undefended = driveEventsPicking(BP_DEPS, s, firstLegal, endTurn(P1)).state;
    expect(threat(ended)).toBe(threat(undefended) - 2);
  });
  it("in alter-ego form there is no response: Shuri's recover and a thwart ability trigger nothing", () => {
    let s = withUpgrades(GENIUS);
    s = withForm(patchInstance(s, identityOf(s), { damage: 3 }), "alterEgo");
    const after = driveEventsPicking(BP_DEPS, s, takeResponse(), { type: "basicRecover", playerId: P1 }).state;
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(threat(after)).toBe(SCHEME_THREAT);
    expect(after.pendingChoice).toBeNull();
  });
  it("a Special resolved this way is not a basic power: no second response follows it", () => {
    const s = withUpgrades(CLAWS, GENIUS);
    const { state } = driveEventsPicking(BP_DEPS, s, takeResponse(CLAWS), attack(s));
    // Had Panther Claws' attack chained a second response, Tactical Genius would have removed 2 threat too.
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(threat(state)).toBe(SCHEME_THREAT);
  });
  it("the Black Panther upgrade named must be one you control: another player's is not a target", () => {
    const own = bpHeroGame({ swap: SWAP, twoPlayers: true });
    const given = moveToHand(own, P1, GENIUS);
    // The second seat's Core deck has no Black Panther upgrade, so the only Special is P1's own; with none in play P1 resolves nothing.
    const s = patchInstance(given.state, schemeOf(given.state), { threat: SCHEME_THREAT });
    const { state } = driveEventsPicking(BP_DEPS, s, takeResponse(), thwart(s));
    expect(threat(state)).toBe(3);
  });
});
