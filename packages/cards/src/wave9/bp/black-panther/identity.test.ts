import { BP_CARDS, WAVE9_STARTER_DECKS, cardId, type HeroIdentityCard } from "@mc/content";
import {
  applyCommand,
  handSize,
  legalActions,
  maxHitPoints,
  requiredIdentitySet,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
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
  use,
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
  it(`${RESPONSE} is an optional response`, () => {
    expect(BLACK_PANTHER_IDENTITY[RESPONSE]!.trigger).toMatchObject({ kind: "response", forced: false });
  });
  it(`${INVENTOR} validates: an alter-ego action, exhausting the identity, once per round`, () => {
    const inventor = BLACK_PANTHER_IDENTITY[INVENTOR]!;
    expect(validateDefinition(inventor)).toEqual([]);
    expect(inventor.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(inventor.cost).toEqual({ exhaustIdentity: true });
    expect(inventor.limit).toEqual({ count: 1, period: "round" });
    expect(inventor.effects).toMatchObject([
      { kind: "playFromHand", from: "deck", costReduction: { kind: "const", value: 2 } },
    ]);
  });
  it("both printed refs of the card are registered and none is skipped", () => {
    expect(Object.keys(BLACK_PANTHER_IDENTITY).sort()).toEqual([INVENTOR, RESPONSE].sort());
    expect(BLACK_PANTHER_IDENTITY_SKIPPED).toEqual({});
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

describe(`${INVENTOR}: exhaust Shuri, search your deck for a Black Panther or Tech upgrade and play it, reducing its resource cost by 2 (limit once per round)`, () => {
  const KIMOYO = "51010";
  const GEAR = "51019";
  const RIFLE = "51020";
  const AJA = "51009";
  const cardOf = (code: string) => BP_CARDS.find((c) => c.id === cardId(code))!;
  const isUpgrade = (s: GameState, id: InstanceId) => cardOf(codeOf(s, id)).type === "upgrade";
  const resourcesOf = (s: GameState, id: InstanceId): number =>
    Object.values((cardOf(codeOf(s, id)) as { resourceIcons?: Record<string, number> }).resourceIcons ?? {}).reduce(
      (n, v) => n + v,
      0,
    );

  /**
   * Shuri at the start of her turn with exactly `handCards` cards in hand, each worth 1 resource and none an upgrade,
   * and every other card of the precon in her deck (so every upgrade is there to be searched for).
   */
  function shuri(handCards: number, keepInDeck: (code: string) => boolean = () => true): GameState {
    const s = bpGame();
    const owner = playerOf(s, P1);
    const all = [...owner.hand, ...owner.deck];
    const hand = all.filter((id) => !isUpgrade(s, id) && resourcesOf(s, id) === 1).slice(0, handCards);
    expect(hand).toHaveLength(handCards);
    const rest = all.filter((id) => !hand.includes(id));
    const deck = rest.filter((id) => !isUpgrade(s, id) || keepInDeck(codeOf(s, id)));
    const removed = rest.filter((id) => !deck.includes(id));
    return {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, hand, deck, discard: [...p.discard, ...removed] } : p,
      ),
    };
  }

  interface Seen {
    offered: string[][];
    asked: number[];
  }
  /** Uses Inventor, taking `want` (a code) from the search and paying exactly what is asked from hand. */
  function invent(s: GameState, want: string) {
    const seen: Seen = { offered: [], asked: [] };
    const pick: Picker = (state) => {
      const choice = state.pendingChoice!;
      if (choice.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand") {
        seen.offered.push(choice.options.map((o) => codeOf(state, o.optionId as InstanceId)));
        const option = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === want);
        return option ? [option.optionId] : firstLegal(state);
      }
      if (choice.prompt.kind === "spendResources") {
        const needed = choice.prompt.requirement.generic ?? 0;
        seen.asked.push(needed);
        return choice.options.slice(0, needed).map((o) => o.optionId);
      }
      return firstLegal(state);
    };
    const run = driveEventsPicking(BP_DEPS, s, pick, use(P1, identityOf(s), INVENTOR));
    return { ...run, seen };
  }
  const played = (events: readonly GameEvent[]) =>
    events.flatMap((e) => (e.type === "cardPlayed" ? [[e.cardId as string, e.resourcesPaid]] : []));
  const shuffles = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P1);
  const attached = (s: GameState) => inst(s, identityOf(s)).attachments.map((id) => codeOf(s, id));
  const handCount = (s: GameState) => playerOf(s, P1).hand.length;

  it("the whole deck is searched: exactly the precon's Black Panther and Tech upgrades are offered (the justice Tech upgrades too), not Aja-Adanna", () => {
    const { seen } = invent(shuri(4), KIMOYO);
    const expected = PRECON.cards
      .map((l) => cardOf(l.cardId as string))
      .filter(
        (c) =>
          c.type === "upgrade" && (c.traits as readonly string[]).some((t) => t === "BLACK PANTHER" || t === "TECH"),
      )
      .map((c) => c.id as string);
    expect(expected).toEqual(["51010", "51011", "51012", "51013", GEAR, RIFLE]);
    expect([...new Set(seen.offered[0])].sort()).toEqual(expected);
    expect(cardOf(AJA).type).toBe("upgrade");
    expect(seen.offered[0]).not.toContain(AJA);
  });

  it("Kimoyo Beads (cost 2) is played for 0: nothing is asked for, the hand keeps its 4 cards, Shuri is exhausted", () => {
    const s = shuri(4);
    const { state, events, seen } = invent(s, KIMOYO);
    expect(cardOf(KIMOYO)).toMatchObject({ cost: 2 });
    expect(seen.asked).toEqual([]);
    expect(played(events)).toEqual([[KIMOYO, 0]]);
    expect(attached(state)).toEqual([KIMOYO]);
    expect(handCount(state)).toBe(4);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(s, P1).deck.length - 1);
  });

  it("it is played, and the deck is shuffled once, after the upgrade has entered play", () => {
    const { events } = invent(shuri(4), KIMOYO);
    const playedAt = events.findIndex((e) => e.type === "cardPlayed");
    expect(shuffles(events)).toHaveLength(1);
    expect(events.indexOf(shuffles(events)[0]!)).toBeGreaterThan(playedAt);
    expect(
      events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardPlayed" && e.phase === "resolved"),
    ).toBe(true);
  });

  it("Sonic Rifle (cost 3) with one card in hand: 1 resource is asked for and paid, the hand is empty, the rifle has its 2 charge counters", () => {
    const { state, events, seen } = invent(shuri(1), RIFLE);
    expect(cardOf(RIFLE)).toMatchObject({ cost: 3 });
    expect(seen.asked).toEqual([1]);
    expect(played(events)).toEqual([[RIFLE, 1]]);
    expect(attached(state)).toEqual([RIFLE]);
    expect(handCount(state)).toBe(0);
    const rifle = inst(state, identityOf(state)).attachments[0]!;
    expect(inst(state, rifle).counters.charge).toBe(2);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("a Tech upgrade of another aspect qualifies: Invisibility Gear (justice, cost 1) is played for 0", () => {
    const { state, events, seen } = invent(shuri(0), GEAR);
    expect(cardOf(GEAR)).toMatchObject({ cost: 1, aspect: "justice" });
    expect(seen.asked).toEqual([]);
    expect(played(events)).toEqual([[GEAR, 0]]);
    expect(Object.values(state.instances).some((i) => (i.cardId as string) === GEAR && i.attachedTo !== null)).toBe(
      true,
    );
  });

  it("Sonic Rifle with an empty hand and no resource ability is not offered, though the upgrades the reduction makes free are", () => {
    const { seen, events } = invent(shuri(0), RIFLE);
    expect(seen.offered[0]).not.toContain(RIFLE);
    expect([...new Set(seen.offered[0])].sort()).toEqual(["51010", "51011", "51012", "51013", GEAR]);
    expect(played(events).map(([code]) => code)).not.toContain(RIFLE);
  });

  it("with only Sonic Rifles to find and an empty hand nothing is offered or played: Shuri is exhausted and the deck shuffled", () => {
    const s = shuri(0, (code) => code === RIFLE);
    const legal = legalActions(s, P1, BP_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === INVENTOR)).toBe(true);
    const { state, events, seen } = invent(s, RIFLE);
    expect(seen).toEqual({ offered: [], asked: [] });
    expect(played(events)).toEqual([]);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(shuffles(events)).toHaveLength(1);
    expect(playerOf(state, P1).deck.filter((id) => codeOf(state, id) === RIFLE)).toHaveLength(3);
  });

  it("a second use in the round is refused, even with Shuri readied", () => {
    const { state } = invent(shuri(4), KIMOYO);
    const readied = patchInstance(state, identityOf(state), { exhausted: false });
    const again = applyCommand(readied, use(P1, identityOf(readied), INVENTOR), BP_DEPS);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("limit_reached");
  });

  it("an exhausted Shuri cannot pay, and Black Panther (hero form) does not have the action", () => {
    const s = shuri(4);
    const tired = applyCommand(
      patchInstance(s, identityOf(s), { exhausted: true }),
      use(P1, identityOf(s), INVENTOR),
      BP_DEPS,
    );
    expect(tired.ok).toBe(false);
    const hero = withForm(s, { heroForm: 0 });
    expect(applyCommand(hero, use(P1, identityOf(hero), INVENTOR), BP_DEPS).ok).toBe(false);
  });
});
