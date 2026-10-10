import { CORE_CARDS, SILK_CARDS, cardId, type EventCard } from "@mc/content";
import { activeEncounterDeckId, applyCommand, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
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
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { SILK_DEPS, engageMinion, silkGame, silkHeroGame, tuckEncounterCard } from "../testing.js";
import { SILK_EVENTS, SILK_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Silk's events (52002 to 52004), docs/phase7-wave9.md section 3.39. Core's Rhino set stands in for the encounter sets:
 * Rhino, his main scheme and Hydra Mercenary 01101 (3 hit points, guard), Sandman 01102 (4 hit points), Shocker 01103,
 * Breakin' & Takin' 01107 (side scheme) are the Rhino set; Advance 01186 is the Standard set, a different one.
 * Silk's ATK is 2 and her THW 1; the cards tucked here are staged by surgery.
 */
const SMOOTH = "52002.smooth-as-silk-action";
const KICK = "52003.swinging-silk-kick-action";
const CRAWL = "52004.wallcrawl-action";
const MERC = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
const SIDE = "01107";
const ADVANCE = "01186";

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const tuckedOf = (s: GameState): readonly InstanceId[] => inst(s, identityOf(s)).tucked;
const tuckedCodes = (s: GameState): string[] => tuckedOf(s).map((id) => codeOf(s, id));
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));
const encounterPiles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const encounterDiscardCodes = (s: GameState): string[] => encounterPiles(s).discard.map((id) => codeOf(s, id));
const card = (code: string) => SILK_CARDS.find((c) => c.id === cardId(code)) as EventCard;
const withThreat = (s: GameState, id: InstanceId, threat: number): GameState => patchInstance(s, id, { threat });

/** Plays the event `code` for `cost`, answering each prompt with `pick`. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  return driveEventsPicking(SILK_DEPS, given.state, pick, play(P1, event, payWith(given.state, P1, cost, [event])));
}

/** Answers a target prompt with `target` when offered, a card choice with `keep` when offered, as `firstLegal` otherwise. */
const choosing =
  (opts: { target?: InstanceId; cards?: readonly InstanceId[] }): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (opts.target && ids.includes(opts.target)) return [opts.target];
    const wanted = (opts.cards ?? []).filter((c) => ids.includes(c));
    if (wanted.length > 0 && choice.prompt.kind !== "chooseTarget") return wanted;
    return firstLegal(s);
  };

/** Every prompt answered with `pick`, and each prompt's kind recorded. */
function recording(pick: Picker): { readonly kinds: string[]; readonly picker: Picker } {
  const kinds: string[] = [];
  return {
    kinds,
    picker: (s) => {
      kinds.push(s.pendingChoice!.prompt.kind);
      return pick(s);
    },
  };
}

const threatEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "thwart");

describe("Silk events registry", () => {
  it("every ability validates as a Hero Action with its printed label", () => {
    expect(Object.keys(SILK_EVENTS).sort()).toEqual([SMOOTH, KICK, CRAWL].sort());
    for (const ref of [SMOOTH, KICK, CRAWL]) {
      expect(validateDefinition(SILK_EVENTS[ref]!), ref).toEqual([]);
      expect(SILK_EVENTS[ref]!.trigger, ref).toMatchObject({ kind: "action", form: "hero" });
    }
    expect(SILK_EVENTS[SMOOTH]!.label).toBeUndefined();
    expect(SILK_EVENTS[KICK]!.label).toEqual(["attack"]);
    expect(SILK_EVENTS[CRAWL]!.label).toEqual(["thwart"]);
  });
  it("the printed card data names exactly these refs, with costs 0, 3 and 1 and the printed traits", () => {
    for (const [code, ref, cost, trait] of [
      ["52002", SMOOTH, 0, undefined],
      ["52003", KICK, 3, "ATTACK"],
      ["52004", CRAWL, 1, "THWART"],
    ] as const) {
      expect(card(code).abilities.map((a) => a.id as string)).toEqual([ref]);
      expect(card(code).cost).toBe(cost);
      if (trait) expect(card(code).traits.map(String)).toContain(trait);
    }
  });
  it("Get the Scoop 52005 is listed here by card-groups.ts but skipped with a reason: both of its refs", () => {
    expect(Object.keys(SILK_EVENTS_SKIPPED).sort()).toEqual(["52005.get-the-scoop-action", "52005.when-defeated"]);
    const scoop = SILK_CARDS.find((c) => c.id === cardId("52005")) as unknown as { abilities: { id: string }[] };
    const printed = scoop.abilities;
    expect(printed.map((a) => a.id as string).sort()).toEqual(Object.keys(SILK_EVENTS_SKIPPED).sort());
    for (const reason of Object.values(SILK_EVENTS_SKIPPED)) expect(reason).toMatch(/support-upgrades-allies/);
  });
});

describe(`${SMOOTH} (Smooth as Silk 52002): discard until a card of the chosen card's set, tuck it`, () => {
  it("costs 0: the event goes to the discard pile; choosing Rhino with Advance then Sandman on top tucks Sandman (1 tucked)", () => {
    const s = stackEncounterDeck(silkHeroGame(), ADVANCE, SANDMAN);
    const before = playerOf(s, P1).hand.length;
    const { state } = playEvent(s, "52002", 0, choosing({ target: villainOf(s) }));
    expect(tuckedCodes(state)).toEqual([SANDMAN]);
    // Advance (Standard set) was discarded on the way and stays in the encounter discard pile.
    expect(encounterDiscardCodes(state)).toContain(ADVANCE);
    expect(encounterDiscardCodes(state)).not.toContain(SANDMAN);
    expect(playerOf(state, P1).hand).toHaveLength(before);
    expect(discardCodes(state)).toContain("52002");
  });
  it("a card of the chosen set on top is the one tucked, and nothing else is discarded", () => {
    const s = stackEncounterDeck(silkHeroGame(), SHOCKER, ADVANCE);
    const { state } = playEvent(s, "52002", 0, choosing({ target: villainOf(s) }));
    expect(tuckedCodes(state)).toEqual([SHOCKER]);
    expect(encounterDiscardCodes(state)).not.toContain(ADVANCE);
  });
  it("a minion in play is a legal choice and gives its set: Hydra Mercenary engaged, Rhino set card tucked", () => {
    const placed = engageMinion(stackEncounterDeck(silkHeroGame(), ADVANCE, SHOCKER), MERC);
    const { state } = playEvent(placed.state, "52002", 0, choosing({ target: placed.id }));
    expect(tuckedCodes(state)).toEqual([SHOCKER]);
  });
  it("a side scheme in play is a legal choice", () => {
    const placed = encounterCardInVillainArea(stackEncounterDeck(silkHeroGame(), SANDMAN), SIDE, 2);
    const { state } = playEvent(placed.state, "52002", 0, choosing({ target: placed.id }));
    expect(tuckedCodes(state)).toEqual([SANDMAN]);
  });
  it("with 4 tucked it tucks a fifth and the cap lets the player discard one of the five: 4 remain", () => {
    let s = stackEncounterDeck(silkHeroGame(), SANDMAN);
    const tucked: InstanceId[] = [];
    for (const code of ["01104", "01105", "01106", "01108"]) {
      const t = tuckEncounterCard(s, code);
      s = t.state;
      tucked.push(t.id);
    }
    expect(tuckedOf(s)).toHaveLength(4);
    const dropped = tucked[0]!;
    // The cap asks which 4 of the 5 stay; the player keeps everything but the first card tucked.
    const keepAllBut =
      (drop: InstanceId): Picker =>
      (x) => {
        const ids = x.pendingChoice!.options.map((o) => o.optionId as string);
        if (x.pendingChoice!.prompt.kind === "chooseCards" && ids.includes(drop))
          return ids.filter((id) => id !== drop).slice(0, 4);
        return choosing({ target: villainOf(x) })(x);
      };
    const { state } = playEvent(s, "52002", 0, keepAllBut(dropped));
    expect(tuckedOf(state)).toHaveLength(4);
    expect(tuckedOf(state)).not.toContain(dropped);
    expect(encounterDiscardCodes(state)).toContain("01104");
  });
  it("no card of that set left: the deck is discarded to the end, reset once, and nothing is tucked", () => {
    const base = silkHeroGame();
    const deckId = activeEncounterDeckId(base);
    const rhinoCodes = new Set(
      CORE_CARDS.filter((c) => (c as { encounterSetIds?: string[] }).encounterSetIds?.includes("rhino")).map(
        (c) => c.id as string,
      ),
    );
    const rhinoSet = new Set(
      Object.values(base.instances)
        .filter((i) => rhinoCodes.has(i.cardId as string))
        .map((i) => i.instanceId),
    );
    const piles = base.encounterDecks[deckId]!;
    // The Rhino-set encounter cards are out of the game's deck (set aside by surgery), so none can be found.
    const s = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: piles.deck.filter((i) => !rhinoSet.has(i)),
          discard: piles.discard.filter((i) => !rhinoSet.has(i)),
        },
      },
    };
    const total = encounterPiles(s).deck.length + encounterPiles(s).discard.length;
    const { state } = playEvent(s, "52002", 0, choosing({ target: villainOf(s) }));
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterPiles(state).deck.length + encounterPiles(state).discard.length).toBe(total);
    expect(state.mainScheme.accelerationTokens).toBe(s.mainScheme.accelerationTokens + 1);
    expect(state.pendingChoice).toBeNull();
  });
  it("is a hero action: refused in alter-ego form", () => {
    const s = silkGame();
    const given = moveToHand(s, P1, "52002");
    expect(applyCommand(given.state, play(P1, given.ids[0]!), SILK_DEPS).ok).toBe(false);
  });
});

describe(`${KICK} (Swinging Silk Kick 52003): 7 damage to an enemy; discard a matching tucked card for +2 and overkill`, () => {
  it("costs 3 and is an attack: three other cards are discarded, Rhino takes 7 with no tucked cards, no prompt but the target", () => {
    const s = silkHeroGame();
    const before = playerOf(s, P1).hand.length;
    const rec = recording(firstLegal);
    const { state, events } = playEvent(s, "52003", 3, rec.picker);
    expect(inst(state, villainOf(state)).damage).toBe(7);
    expect(playerOf(state, P1).hand).toHaveLength(before - 3);
    expect(discardCodes(state)).toContain("52003");
    expect(events.filter((e) => e.type === "cardDiscardedFromHand")).toHaveLength(3);
    expect(rec.kinds.filter((k) => k !== "chooseTarget")).toEqual([]);
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack",
    );
    expect(attacks).toMatchObject([{ event: { amount: 7, basic: false } }]);
  });
  it("one matching card tucked and the player takes the discard: 9 damage, the card goes to the encounter discard pile", () => {
    const t = tuckEncounterCard(silkHeroGame(), SANDMAN);
    const { state } = playEvent(t.state, "52003", 3, choosing({ target: villainOf(t.state), cards: [t.id] }));
    expect(inst(state, villainOf(state)).damage).toBe(9);
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscardCodes(state)).toContain(SANDMAN);
  });
  it("the player may decline the discard: 7 damage, the tucked card stays (1 tucked)", () => {
    const t = tuckEncounterCard(silkHeroGame(), SANDMAN);
    const rec = recording(firstLegal);
    const { state } = playEvent(t.state, "52003", 3, rec.picker);
    expect(rec.kinds).toContain("chooseCards");
    expect(inst(state, villainOf(state)).damage).toBe(7);
    expect(tuckedOf(state)).toEqual([t.id]);
  });
  it("a tucked card of another set (Advance, Standard) against Rhino is not offered: 7 damage, 1 still tucked", () => {
    const t = tuckEncounterCard(silkHeroGame(), ADVANCE);
    const rec = recording(choosing({ target: villainOf(t.state), cards: [t.id] }));
    const { state } = playEvent(t.state, "52003", 3, rec.picker);
    expect(rec.kinds).not.toContain("chooseCards");
    expect(inst(state, villainOf(state)).damage).toBe(7);
    expect(tuckedOf(state)).toEqual([t.id]);
  });
  it("with 4 tucked (two Rhino set, two Standard): only the Rhino set cards are offered, one is discarded: 9, 3 remain", () => {
    let s = silkHeroGame();
    const ids: Record<string, InstanceId> = {};
    for (const code of [SANDMAN, SHOCKER, ADVANCE, "01104"]) {
      const t = tuckEncounterCard(s, code);
      s = t.state;
      ids[code] = t.id;
    }
    // Hard to Keep Down 01104 is a Rhino set card as well: three matching, one not.
    let offered: string[] = [];
    const pick: Picker = (x) => {
      if (x.pendingChoice!.prompt.kind === "chooseCards") {
        offered = x.pendingChoice!.options.map((o) => o.optionId as string);
        return [ids[SANDMAN]!];
      }
      return choosing({ target: villainOf(x) })(x);
    };
    const { state } = playEvent(s, "52003", 3, pick);
    expect(offered.sort()).toEqual([ids[SANDMAN]!, ids[SHOCKER]!, ids["01104"]!].sort());
    expect(inst(state, villainOf(state)).damage).toBe(9);
    expect(tuckedOf(state)).toHaveLength(3);
    expect(tuckedOf(state)).not.toContain(ids[SANDMAN]);
  });
  it("overkill: against Sandman (4 hit points) 9 damage defeats him and 5 spills to Rhino; without the discard 7 spills nothing", () => {
    const placed = engageMinion(silkHeroGame(), SANDMAN);
    const t = tuckEncounterCard(placed.state, SHOCKER);
    const withDiscard = playEvent(t.state, "52003", 3, choosing({ target: placed.id, cards: [t.id] })).state;
    expect(inst(withDiscard, villainOf(withDiscard)).damage).toBe(5);
    expect(encounterDiscardCodes(withDiscard)).toContain(SANDMAN);
    const without = playEvent(t.state, "52003", 3, (x) => {
      if (x.pendingChoice!.prompt.kind === "chooseCards") return [];
      return choosing({ target: placed.id })(x);
    }).state;
    expect(inst(without, villainOf(without)).damage).toBe(0);
  });
  it("the tucked card must match the chosen enemy, not Rhino: attacking Sandman engaged (Rhino set) still matches a Rhino set card", () => {
    const placed = engageMinion(silkHeroGame(), SANDMAN);
    const t = tuckEncounterCard(placed.state, ADVANCE);
    const rec = recording(choosing({ target: placed.id }));
    playEvent(t.state, "52003", 3, rec.picker);
    expect(rec.kinds).not.toContain("chooseCards");
  });
  it("Hydra Mercenary's guard applies: Rhino cannot be chosen while it is engaged", () => {
    const placed = engageMinion(silkHeroGame(), MERC);
    const given = moveToHand(placed.state, P1, "52003");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)),
      SILK_DEPS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const targets = result.state.pendingChoice!.options.map((o) => o.optionId as string);
      expect(targets).toEqual([placed.id]);
    }
  });
  it("is a hero action: refused in alter-ego form, and nothing is paid", () => {
    const s = silkGame();
    const given = moveToHand(s, P1, "52003");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)),
      SILK_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});

describe(`${CRAWL} (Wallcrawl 52004): remove 2 threat from a scheme, then 3 more by discarding a matching tucked card`, () => {
  it("costs 1 and is a thwart: the main scheme at 6 goes to 4 with nothing tucked, and only targets are asked", () => {
    const s = withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 6);
    const before = playerOf(s, P1).hand.length;
    const rec = recording(firstLegal);
    const { state, events } = playEvent(s, "52004", 1, rec.picker);
    expect(inst(state, schemeOf(state)).threat).toBe(4);
    expect(playerOf(state, P1).hand).toHaveLength(before - 1);
    expect(discardCodes(state)).toContain("52004");
    expect(threatEvents(events)).toHaveLength(1);
    expect(rec.kinds.filter((k) => k !== "chooseTarget")).toEqual([]);
  });
  it("with a Rhino set card tucked and the discard taken: the chosen scheme loses 2 then 3 (6 to 1); the card is discarded", () => {
    const base = withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 6);
    const t = tuckEncounterCard(base, SANDMAN);
    const { state } = playEvent(t.state, "52004", 1, choosing({ target: schemeOf(t.state), cards: [t.id] }));
    expect(inst(state, schemeOf(state)).threat).toBe(1);
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscardCodes(state)).toContain(SANDMAN);
  });
  it("the second scheme can be another one: 2 off the main scheme (6 to 4), 3 off a side scheme (5 to 2)", () => {
    const placed = encounterCardInVillainArea(withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 6), SIDE, 5);
    const t = tuckEncounterCard(placed.state, SANDMAN);
    let asked = 0;
    const pick: Picker = (x) => {
      const choice = x.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget") return [++asked === 1 ? schemeOf(x) : placed.id];
      return choosing({ cards: [t.id] })(x);
    };
    const { state } = playEvent(t.state, "52004", 1, pick);
    expect(inst(state, schemeOf(state)).threat).toBe(4);
    expect(inst(state, placed.id).threat).toBe(2);
    expect(tuckedOf(state)).toEqual([]);
  });
  it("declining the discard: only the 2 are removed and the tucked card stays", () => {
    const base = withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 6);
    const t = tuckEncounterCard(base, SANDMAN);
    const rec = recording(firstLegal);
    const { state } = playEvent(t.state, "52004", 1, rec.picker);
    expect(rec.kinds).toContain("chooseCards");
    expect(inst(state, schemeOf(state)).threat).toBe(4);
    expect(tuckedOf(state)).toEqual([t.id]);
  });
  it("a tucked card of another set (Advance) is not offered: 2 removed, 1 still tucked", () => {
    const base = withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 6);
    const t = tuckEncounterCard(base, ADVANCE);
    const rec = recording(choosing({ cards: [t.id] }));
    const { state } = playEvent(t.state, "52004", 1, rec.picker);
    expect(rec.kinds).not.toContain("chooseCards");
    expect(inst(state, schemeOf(state)).threat).toBe(4);
    expect(tuckedOf(state)).toEqual([t.id]);
  });
  it("with 4 tucked, one matching is discarded: 3 remain", () => {
    let s = withThreat(silkHeroGame(), schemeOf(silkHeroGame()), 8);
    const ids: InstanceId[] = [];
    for (const code of [SANDMAN, ADVANCE, "01186", "01104"]) {
      const t = tuckEncounterCard(s, code);
      s = t.state;
      ids.push(t.id);
    }
    const { state } = playEvent(s, "52004", 1, choosing({ target: schemeOf(s), cards: [ids[0]!] }));
    expect(inst(state, schemeOf(state)).threat).toBe(3);
    expect(tuckedOf(state)).toHaveLength(3);
    expect(tuckedOf(state)).not.toContain(ids[0]);
  });
  it("is a hero action: refused in alter-ego form, and nothing is paid", () => {
    const s = withForm(silkHeroGame(), "alterEgo");
    const given = moveToHand(s, P1, "52004");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)),
      SILK_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});
