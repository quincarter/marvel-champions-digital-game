import { FALCON_CARDS, cardId, trait, type HeroIdentityCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  encounterTopFaceup,
  faceVisible,
  handSize,
  legalActions,
  maxHitPoints,
  shownEncounterTop,
  zoneHidden,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { FALCON_DEPS, encounterTopCodes, falconGame, falconHeroGame, stackedEncounter } from "../testing.js";
import { FALCON_IDENTITY, FALCON_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Falcon (53001a/b), docs/phase7-wave9.md section 8.4, 3.42 and 3.43. The printed precon `falcon-leadership` against
 * Rhino. Hero face: ATK 2, THW 2, DEF 2, hand size 5, 10 hit points; alter-ego face: REC 3, hand size 6. Redwing (53002),
 * Falcon's Flock (53006) and Soup Kitchen (53007) are other modules' cards: only that they are played is used here.
 */
const CONSTANT = "53001a.falcon-constant";
const EAGLE = "53001a.eagle-eyed";
const BIRDS = "53001b.birds-of-a-feather";
const REDWING = "53002"; // Aerial, Bird ally, cost 2
const FLOCK = "53006"; // Aerial, Bird support, cost 2
const KITCHEN = "53007"; // Location support (not Aerial), cost 1
const ENERGY = "53025";
const GENIUS = "53026";
const STRENGTH = "53027";
const CHARGE = "01099"; // 2 boost icons
const MERCENARY = "01101"; // 1 boost icon
const SUIT = "01098"; // 0 boost icons
const TOUGH = "01104"; // 0 boost icons

const IDENTITY = FALCON_CARDS.find((c) => c.id === cardId("53001a")) as HeroIdentityCard;

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const deckOf = (s: GameState) => activeEncounterDeck(s).deck;
const discardOf = (s: GameState) => activeEncounterDeck(s).discard;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const shownIds = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterTopShown" ? [e.instanceId] : []));
const hiddenCount = (events: readonly GameEvent[]) => events.filter((e) => e.type === "encounterTopHidden").length;
/** What each of the two seats, and the table with no seat named, can read of this card's face. */
const seatsSeeing = (s: GameState, id: InstanceId): boolean[] =>
  [{ viewer: P1 }, { viewer: P2 }, {}].map((view) => faceVisible(s, id, { ...view, deps: FALCON_DEPS }));

const offeredAbilities = (s: GameState): string[] => {
  const legal = legalActions(s, P1, FALCON_DEPS);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal.flatMap((a) => (a.action.kind === "useAbility" ? [a.action.abilityId as string] : []));
};

/** Takes Eagle-Eyed when it is offered (or declines it), the hero always defending; records what was offered. */
const eaglePicker = (take: boolean, offered: string[] = []): Picker => {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      offered.push(...choice.options.map((o) => o.optionId));
      const mine = choice.options.find((o) => o.optionId.endsWith(EAGLE));
      return mine && take ? [mine.optionId] : firstLegal(s);
    }
    return firstLegal(s);
  };
};

/** A game with the given cards in hand: hero form or not, the encounter deck stacked with `top` (top first). */
function table(opts: { hero?: boolean; top?: readonly string[]; players?: 1 | 2 } = {}): GameState {
  const base = opts.hero
    ? falconHeroGame({ twoPlayers: opts.players === 2 })
    : falconGame({ twoPlayers: opts.players === 2 });
  return opts.top ? stackedEncounter(base, ...opts.top) : base;
}

/** Plays `code` from hand (it is moved there, with resource cards to pay), answering with `pick`. */
function playCard(s: GameState, code: string, pick: Picker, resources: readonly string[]) {
  const given = moveToHand(s, P1, code, ...resources);
  const [card, ...pay] = given.ids;
  return driveEventsPicking(FALCON_DEPS, given.state, pick, play(P1, card!, pay));
}

describe("Falcon identity registry", () => {
  it("every ability validates, with the printed timing", () => {
    for (const id of [CONSTANT, EAGLE, BIRDS]) expect(validateDefinition(FALCON_IDENTITY[id]!), id).toEqual([]);
    expect(FALCON_IDENTITY[CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(FALCON_IDENTITY[EAGLE]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(FALCON_IDENTITY[BIRDS]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(FALCON_IDENTITY[BIRDS]!.limit).toEqual({ count: 1, period: "round" });
    expect(FALCON_IDENTITY[EAGLE]!.limit).toBeUndefined();
    expect(FALCON_IDENTITY[EAGLE]!.cost).toBeUndefined();
  });
  it("all three printed refs are registered and none is skipped", () => {
    expect(FALCON_IDENTITY_SKIPPED).toEqual({});
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([BIRDS, CONSTANT, EAGLE].sort());
    expect(Object.keys(FALCON_IDENTITY).sort()).toEqual(printed.sort());
  });
});

describe("printed stats, read from the game", () => {
  it("data: hero ATK 2, THW 2, DEF 2, hand size 5, 10 hit points; alter ego REC 3, hand size 6; traits", () => {
    expect(IDENTITY.hp).toBe(10);
    expect(IDENTITY.hero).toMatchObject({ atk: 2, thw: 2, def: 2, handSize: 5 });
    expect(IDENTITY.alterEgo).toMatchObject({ rec: 3, handSize: 6 });
    expect(IDENTITY.hero.traits).toEqual([trait("AERIAL"), trait("AVENGER")]);
    expect(IDENTITY.alterEgo.traits).toEqual([trait("S.H.I.E.L.D.")]);
    expect(IDENTITY.unique).toBe(true);
    expect(IDENTITY.hero.keywords).toEqual([]);
    expect(IDENTITY.alterEgo.keywords).toEqual([]);
  });
  it("starts in alter-ego form with a hand of 6 and a 34-card deck, 10 hit points", () => {
    const s = falconGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, FALCON_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), FALCON_DEPS)).toBe(10);
  });
  it("REC 3: recovering from 6 damage leaves 3", () => {
    const hurt = withDamage(falconGame(), identityOf(falconGame()), 6);
    const after = driveEventsPicking(FALCON_DEPS, hurt, firstLegal, { type: "basicRecover", playerId: P1 }).state;
    expect(inst(after, identityOf(after)).damage).toBe(3);
  });
  it("hero form: hand size 5; THW 2 takes the scheme from 5 to 3; ATK 2 deals 2 damage to Rhino", () => {
    const s = patchInstance(falconHeroGame(), schemeOf(falconHeroGame()), { threat: 5 });
    expect(handSize(s, P1, FALCON_DEPS)).toBe(5);
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: schemeOf(s),
    };
    const thwarted = driveEventsPicking(FALCON_DEPS, s, firstLegal, thwart).state;
    expect(inst(thwarted, schemeOf(thwarted)).threat).toBe(3);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s),
      targetInstanceId: villainOf(s),
    };
    const hit = driveEventsPicking(FALCON_DEPS, s, firstLegal, attack).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(2);
  });
  it("DEF 2: a defended enemy attack deals 2 less damage than the same attack undefended", () => {
    const s = falconHeroGame();
    const undefended = driveEventsPicking(FALCON_DEPS, s, firstLegal, endTurn()).state;
    const defended = driveEventsPicking(
      FALCON_DEPS,
      s,
      (st) => (st.pendingChoice!.prompt.kind === "declareDefender" ? [identityOf(st)] : firstLegal(st)),
      endTurn(),
    ).state;
    const dealt = inst(undefended, identityOf(undefended)).damage;
    expect(dealt).toBeGreaterThanOrEqual(2);
    expect(inst(defended, identityOf(defended)).damage).toBe(Math.max(0, dealt - 2));
  });
});

describe(`${CONSTANT}: during the player phase, play with the top card of the encounter deck faceup`, () => {
  it("alter-ego form: the top card is facedown to every player, and nothing is shown", () => {
    const s = table({ top: [CHARGE, MERCENARY, TOUGH], players: 2 });
    expect(encounterTopFaceup(s, FALCON_DEPS)).toBe(false);
    expect(shownEncounterTop(s, FALCON_DEPS)).toBeNull();
    expect(seatsSeeing(s, deckOf(s)[0]!)).toEqual([false, false, false]);
  });
  it("changing to hero form in the player phase shows the top card to both players, with one log line", () => {
    const start = table({ top: [CHARGE, MERCENARY, TOUGH], players: 2 });
    const top = deckOf(start)[0]!;
    const { state, events } = driveEventsPicking(FALCON_DEPS, start, firstLegal, changeForm());
    expect(encounterTopCodes(state, 3)).toEqual([CHARGE, MERCENARY, TOUGH]);
    expect(shownIds(events)).toEqual([top]);
    expect(events.find((e) => e.type === "encounterTopShown")).toMatchObject({ cardId: cardId(CHARGE) });
    expect(shownEncounterTop(state, FALCON_DEPS)).toBe(top);
    expect(seatsSeeing(state, top)).toEqual([true, true, true]);
    expect(zoneHidden(state, top, { deps: FALCON_DEPS })).toBe(false);
    // Only the top card is shown; the second is still hidden, and nothing was moved or looked at.
    expect(seatsSeeing(state, deckOf(state)[1]!)).toEqual([false, false, false]);
    expect(events.some((e) => e.type === "cardsLookedAt" || e.type === "cardMoved")).toBe(false);
    expect(deckOf(state)).toEqual(deckOf(start));
  });
  it("changing back to alter-ego form hides it again", () => {
    const start = table({ top: [CHARGE, MERCENARY], players: 2 });
    const up = driveEventsPicking(FALCON_DEPS, start, firstLegal, changeForm()).state;
    expect(encounterTopFaceup(up, FALCON_DEPS)).toBe(true);
    // A card that allows a second change this round is not scripted yet: the once-per-round flag is cleared by staging.
    const again: GameState = {
      ...up,
      players: up.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, changedFormThisRound: false } } : p,
      ),
    };
    const back = driveEventsPicking(FALCON_DEPS, again, firstLegal, changeForm());
    expect(playerOf(back.state, P1).identity.form).toBe("alterEgo");
    expect(hiddenCount(back.events)).toBe(1);
    expect(shownEncounterTop(back.state, FALCON_DEPS)).toBeNull();
    expect(seatsSeeing(back.state, deckOf(back.state)[0]!)).toEqual([false, false, false]);
  });
  it("hidden when the villain phase begins, shown again with the new top card when the player phase returns", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH, SUIT, CHARGE, MERCENARY], players: 2 });
    const first = deckOf(start)[0]!;
    const one = driveEventsPicking(FALCON_DEPS, start, firstLegal, endTurn(P1));
    expect(hiddenCount(one.events)).toBe(0);
    expect(seatsSeeing(one.state, first)).toEqual([true, true, true]);
    const two = driveEventsPicking(FALCON_DEPS, one.state, firstLegal, endTurn(P2));
    const types = two.events.map((e) => e.type);
    const toVillain = two.events.findIndex((e) => e.type === "stepChanged" && e.to.phase === "villain");
    expect(hiddenCount(two.events)).toBe(1);
    expect(types.indexOf("encounterTopHidden")).toBeGreaterThanOrEqual(toVillain);
    expect(two.state.step.phase).toBe("player");
    // The boost card and the dealt cards came off the top; the new top is shown and logged once.
    const newTop = deckOf(two.state)[0]!;
    expect(newTop).not.toBe(first);
    expect(shownIds(two.events)).toEqual([newTop]);
    expect(seatsSeeing(two.state, newTop)).toEqual([true, true, true]);
    expect(seatsSeeing(two.state, deckOf(two.state)[1]!)).toEqual([false, false, false]);
  });
  it("the card dealt as a boost card is no longer shown: the next top card comes up", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH, SUIT, CHARGE], players: 1 });
    const first = deckOf(start)[0]!;
    const { state, events } = driveEventsPicking(FALCON_DEPS, start, firstLegal, endTurn());
    expect(deckOf(state)).not.toContain(first);
    expect(discardOf(state)).toContain(first);
    expect(shownIds(events).at(-1)).toBe(deckOf(state)[0]);
    expect(encounterTopFaceup(state, FALCON_DEPS)).toBe(true);
  });
  it("the top card is shown again after a shuffle: an emptied deck is reset and its new top card is logged", () => {
    const base = table({ hero: true, top: [CHARGE, MERCENARY], players: 1 });
    // Leave exactly one card in the deck so the Eagle-Eyed discard empties it (RRG p. 17: reset at once).
    const only = deckOf(base)[0]!;
    const lone: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [Object.keys(base.encounterDecks)[0]!]: {
          deck: [only],
          discard: [...discardOf(base), ...deckOf(base).filter((i) => i !== only)],
        },
      },
    };
    expect(deckOf(lone)).toEqual([only]);
    const { state, events } = playCard(lone, REDWING, eaglePicker(true), [ENERGY, GENIUS]);
    expect(deckOf(state).length).toBeGreaterThan(0);
    // The discarded card went into the reshuffled deck with the rest of the discard pile.
    expect(deckOf(state)).toContain(only);
    expect(discardOf(state)).toEqual([]);
    expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
    expect(shownIds(events).at(-1)).toBe(deckOf(state)[0]);
    expect(seatsSeeing(state, deckOf(state)[0]!)).toEqual([true, true, true]);
  });
});

describe(`${EAGLE}: Response: after you play an Aerial card, discard the top card of the encounter deck`, () => {
  it("playing Redwing (Aerial): accepted, the top card goes to the encounter discard pile and the next is shown", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH] });
    const top = deckOf(start)[0]!;
    const before = discardOf(start).length;
    const offered: string[] = [];
    const { state, events } = playCard(start, REDWING, eaglePicker(true, offered), [ENERGY, GENIUS]);
    expect(offered.filter((o) => o.endsWith(EAGLE))).toHaveLength(1);
    expect(discardOf(state)).toContain(top);
    expect(discardOf(state)).toHaveLength(before + 1);
    expect(encounterTopCodes(state, 2)).toEqual([MERCENARY, TOUGH]);
    expect(shownIds(events).at(-1)).toBe(deckOf(state)[0]);
    expect(state.pendingChoice).toBeNull();
  });
  it("it is a response the player may decline: declined, the deck is unchanged", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH] });
    const { state } = playCard(start, REDWING, eaglePicker(false), [ENERGY, GENIUS]);
    expect(encounterTopCodes(state, 3)).toEqual([CHARGE, MERCENARY, TOUGH]);
  });
  it("any type of Aerial card answers it: Falcon's Flock (a support)", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH] });
    const offered: string[] = [];
    const { state } = playCard(start, FLOCK, eaglePicker(true, offered), [ENERGY, GENIUS]);
    expect(offered.filter((o) => o.endsWith(EAGLE))).toHaveLength(1);
    expect(encounterTopCodes(state, 2)).toEqual([MERCENARY, TOUGH]);
  });
  it("a card without the Aerial trait (Soup Kitchen) does not offer it", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH] });
    const offered: string[] = [];
    const { state } = playCard(start, KITCHEN, eaglePicker(true, offered), [STRENGTH]);
    expect(offered.filter((o) => o.endsWith(EAGLE))).toEqual([]);
    expect(encounterTopCodes(state, 3)).toEqual([CHARGE, MERCENARY, TOUGH]);
  });
  it("no limit: a second Aerial card in the same turn discards a second card", () => {
    const start = table({ hero: true, top: [CHARGE, MERCENARY, TOUGH, SUIT] });
    const first = playCard(start, REDWING, eaglePicker(true), [ENERGY, GENIUS]).state;
    const second = playCard(first, FLOCK, eaglePicker(true), [STRENGTH, "53028"]).state;
    expect(encounterTopCodes(second, 2)).toEqual([TOUGH, SUIT]);
    expect(discardOf(second)).toHaveLength(discardOf(start).length + 2);
  });
  it("hero face only: in alter-ego form playing Redwing does not offer it", () => {
    const start = table({ top: [CHARGE, MERCENARY, TOUGH] });
    const offered: string[] = [];
    const { state } = playCard(start, REDWING, eaglePicker(true, offered), [ENERGY, GENIUS]);
    expect(offered.filter((o) => o.endsWith(EAGLE))).toEqual([]);
    expect(encounterTopCodes(state, 3)).toEqual([CHARGE, MERCENARY, TOUGH]);
  });
});

describe(`${BIRDS}: Action: discard 1 card from your hand, search your deck and discard pile for a Bird card (once per round)`, () => {
  const birdsOf = (s: GameState, zone: "hand" | "deck" | "discard") =>
    playerOf(s, P1)[zone].filter((i) => ["53002", "53006", "53017"].includes(codeOf(s, i)));
  const birds = (s: GameState, pay: InstanceId, pick: Picker = firstLegal) =>
    driveEventsPicking(FALCON_DEPS, s, pick, use(P1, identityOf(s), BIRDS, [], { discard: [pay] }));
  /** Picks the named card when the search offers it. */
  const finding =
    (code: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
      return hit ? [hit.optionId] : firstLegal(s);
    };
  const notBird = (s: GameState) => playerOf(s, P1).hand.find((i) => !birdsOf(s, "hand").includes(i))!;

  it("finds Redwing in the deck: it is added to hand, the paid card is discarded, the deck shuffled", () => {
    const s = falconGame();
    const redwing = moveToHand(s, P1, REDWING).ids[0]!;
    const inDeck: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== redwing), deck: [...p.deck, redwing] } : p,
      ),
    };
    const pay = notBird(inDeck);
    const { state, events } = birds(inDeck, pay, finding(REDWING));
    expect(playerOf(state, P1).hand).toContain(redwing);
    expect(playerOf(state, P1).deck).not.toContain(redwing);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(inDeck, P1).hand.length);
    expect(playerOf(state, P1).discard).toEqual([pay]);
    expect(events.filter((e) => e.type === "deckShuffled")).toHaveLength(1);
  });
  it("finds a Bird in the discard pile too", () => {
    const s = falconGame();
    const redwing = moveToHand(s, P1, REDWING).ids[0]!;
    const inDiscard: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== redwing),
              deck: p.deck.filter((i) => i !== redwing),
              discard: [...p.discard, redwing],
            }
          : p,
      ),
    };
    const pay = notBird(inDiscard);
    const { state } = birds(inDiscard, pay, finding(REDWING));
    expect(playerOf(state, P1).hand).toContain(redwing);
    expect(playerOf(state, P1).discard).toEqual([pay]);
  });
  it("the discard is a cost: with no payment the action is refused", () => {
    const s = falconGame();
    const result = applyCommand(s, use(P1, identityOf(s), BIRDS, []), FALCON_DEPS);
    expect(result.ok).toBe(false);
  });
  it("with an empty hand there is nothing to discard: the action is not offered", () => {
    const s = falconGame();
    const empty = { ...s, players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) };
    expect(offeredAbilities(empty)).not.toContain(BIRDS);
    expect(offeredAbilities(s)).toContain(BIRDS);
  });
  it("only Bird cards can be found: nothing else in the deck is offered", () => {
    const s = falconGame();
    const pay = notBird(s);
    const offered: string[] = [];
    birds(s, pay, (st) => {
      offered.push(...(st.pendingChoice?.options.map((o) => codeOf(st, o.optionId as InstanceId)) ?? []));
      return firstLegal(st);
    });
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((c) => ["53002", "53006", "53017"].includes(c))).toBe(true);
  });
  it("limit once per round: a second use in the same round is refused", () => {
    const s = falconGame();
    const first = birds(s, notBird(s)).state;
    expect(first.abilityUses[`${identityOf(first)}:${BIRDS}`]).toBe(1);
    expect(offeredAbilities(first)).not.toContain(BIRDS);
    const second = applyCommand(
      first,
      use(P1, identityOf(first), BIRDS, [], { discard: [notBird(first)] }),
      FALCON_DEPS,
    );
    expect(second.ok).toBe(false);
  });
  it("it is an alter-ego action: not offered in hero form", () => {
    expect(offeredAbilities(falconGame())).toContain(BIRDS);
    expect(offeredAbilities(falconHeroGame())).not.toContain(BIRDS);
  });
  it("the limit belongs to the card and persists across flips (ruling January 26, 2026, Ruling 6 (2))", () => {
    // No scripted card lets Falcon change form twice in a round yet (Aerial Evacuation 53008 is another module's), so the
    // second flip is staged by clearing the once-per-round form-change flag the way such a card's permission would.
    const used = birds(falconGame(), notBird(falconGame())).state;
    const hero = driveEventsPicking(FALCON_DEPS, used, firstLegal, changeForm()).state;
    expect(playerOf(hero, P1).identity.form).toBe("hero");
    const again: GameState = {
      ...hero,
      players: hero.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, changedFormThisRound: false } } : p,
      ),
    };
    const back = driveEventsPicking(FALCON_DEPS, again, firstLegal, changeForm()).state;
    expect(playerOf(back, P1).identity.form).toBe("alterEgo");
    expect(back.abilityUses[`${identityOf(back)}:${BIRDS}`]).toBe(1);
    expect(offeredAbilities(back)).not.toContain(BIRDS);
    expect(applyCommand(back, use(P1, identityOf(back), BIRDS, [], { discard: [notBird(back)] }), FALCON_DEPS).ok).toBe(
      false,
    );
  });
  it("the limit resets next round: the action is offered again", () => {
    const used = birds(falconGame(), notBird(falconGame())).state;
    const next = settle(
      driveEventsPicking(FALCON_DEPS, used, firstLegal, endTurn()).state,
      firstLegal,
      (st) => st.step.phase === "player",
      FALCON_DEPS,
    );
    expect(offeredAbilities(next)).toContain(BIRDS);
  });
});
