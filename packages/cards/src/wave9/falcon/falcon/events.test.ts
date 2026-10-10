import { FALCON_CARDS, cardId, type EventCard } from "@mc/content";
import {
  activeEncounterDeck,
  faceVisible,
  legalActions,
  lookedAtBy,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { allOf, mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { FALCON_DEPS, engageMinion, falconGame, falconHeroGame } from "../testing.js";
import { DISCARD_OPTION_OFFERED_WHEN, FALCON_EVENTS, FALCON_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Falcon's events (53003 to 53005), docs/phase7-wave9.md section 8.4, 3.42 to 3.44, all scripted and tested clause by
 * clause. Falcon is in hero form against Core's Rhino (14 hit points, ATK 2 when he attacks); the encounter deck's top cards
 * are set by test surgery to Core cards of known boost areas:
 * 01098 Armored Rhino Suit 0 icons, 01101 Hydra Mercenary 1, 01099 Charge 2, 01118 Sonic Converter 3, 01121 Weapons
 * Runner 0 icons and a star (1). Cost is paid with Falcon's Energy 53025. Both Bird of Prey and Bird's-Eye View are
 * Aerial, so Falcon's Eagle-Eyed (53001a) is offered after each; these tests decline it unless one says otherwise.
 * Tests that rest on owner question 6 (docs/phase7-wave9.md section 4.1 row 6) name "Q6": flip the constant, flip those.
 */
const BIRD = "53003.bird-of-prey-action";
const VIEW = "53004.birds-eye-view-action";
const AWAY = "53005.up-up-and-away-response";
const EAGLE = "53001a.eagle-eyed";
const ENERGY = "53025";
const ZERO = "01098";
const ONE = "01101"; // Hydra Mercenary, also the guard minion
const TWO = "01099";
const THREE = "01118";
const STAR = "01121";
const CROWD = "01108"; // Crowd Control: a side scheme with a crisis icon
/** Deps without the identity module: the encounter deck's top card stays facedown. */
const NO_FALCON_IDENTITY: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, FALCON_EVENTS) };

const card = (code: string) => FALCON_CARDS.find((c) => c.id === cardId(code)) as EventCard;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const deckOf = (s: GameState) => activeEncounterDeck(s).deck;
const discardOf = (s: GameState) => activeEncounterDeck(s).discard;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const playerDiscardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const heroDamage = (s: GameState): number => inst(s, identityOf(s)).damage;
const attacks = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e] : []));

/** The encounter deck's top cards turned (by surgery) into these cards, top first. */
function withTop(s: GameState, ...codes: readonly string[]): GameState {
  const deck = deckOf(s);
  return codes.reduce((acc, code, n) => patchInstance(acc, deck[n]!, { cardId: cardId(code) }), s);
}

interface Plan {
  /** Answer the "you may discard" prompt (default: yes). */
  readonly discard?: boolean;
  /** The option id to answer a target prompt with, when offered (default: the first). */
  readonly target?: string;
  /** Take Eagle-Eyed when it is offered (default: decline). */
  readonly eagle?: boolean;
  /** One entry per time Up, Up, and Away is offered: swap, keep (look, no swap) or decline. */
  readonly away?: readonly ("swap" | "keep" | "decline")[];
  /** Hand cards that must not be discarded down to hand size. */
  readonly keep?: readonly InstanceId[];
}
interface Seen {
  readonly kind: string;
  readonly labels: readonly string[];
  readonly handSize: number;
  readonly state: GameState;
}

/** A picker following `plan`, recording what it was asked. */
function planned(plan: Plan): { pick: Picker; seen: Seen[] } {
  const seen: Seen[] = [];
  let aways = 0;
  let arrange: "swap" | "keep" = "keep";
  const pick: Picker = (s) => {
    const c = s.pendingChoice!;
    seen.push({
      kind: c.prompt.kind,
      labels: c.options.map((o) => o.label),
      handSize: playerOf(s, P1).hand.length,
      state: s,
    });
    const ids = c.options.map((o) => o.optionId);
    switch (c.prompt.kind) {
      case "chooseTarget":
        return [plan.target !== undefined && ids.includes(plan.target) ? plan.target : ids[0]!];
      case "chooseOption":
        return [plan.discard === false ? "1" : "0"];
      case "discardDownToHandSize":
        return c.options
          .filter((o) => !(plan.keep ?? []).includes(o.optionId as InstanceId))
          .slice(0, c.minSelections)
          .map((o) => o.optionId);
      case "chooseTriggers": {
        const away = c.options.find((o) => o.optionId.endsWith(AWAY));
        if (away) {
          const way = (plan.away ?? [])[aways++] ?? "decline";
          if (way === "decline") return [];
          arrange = way;
          return [away.optionId];
        }
        const eagle = c.options.find((o) => o.optionId.endsWith(EAGLE));
        return eagle && plan.eagle ? [eagle.optionId] : [];
      }
      case "rearrange":
        return arrange === "swap" ? [...ids].reverse() : ids;
      default:
        return firstLegal(s);
    }
  };
  return { pick, seen };
}

/** Plays `code` (with the event and its payment put into hand) from `state`, answering with `plan`. */
function playEvent(state: GameState, code: string, plan: Plan = {}, deps: EngineDeps = FALCON_DEPS) {
  const given = moveToHand(state, P1, code, ENERGY);
  const [event, ...pay] = given.ids;
  const { pick, seen } = planned(plan);
  const result = driveEventsPicking(deps, given.state, pick, play(P1, event!, pay));
  return { ...result, seen, event: event!, payment: pay[0]! };
}

const bird = (top: readonly string[], plan: Plan = {}, deps?: EngineDeps) =>
  playEvent(withTop(falconHeroGame(), ...top), "53003", plan, deps);

describe("Falcon events registry", () => {
  it("registers all three refs, each valid; nothing is skipped", () => {
    expect(Object.keys(FALCON_EVENTS).sort()).toEqual([BIRD, VIEW, AWAY].sort());
    for (const id of Object.keys(FALCON_EVENTS)) expect(validateDefinition(FALCON_EVENTS[id]!), id).toEqual([]);
    expect(FALCON_EVENTS_SKIPPED).toEqual({});
  });
  it("timing words and labels: two Hero Actions (attack, thwart), one Hero Response (defense)", () => {
    expect(FALCON_EVENTS[BIRD]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(FALCON_EVENTS[BIRD]!.label).toEqual(["attack"]);
    expect(FALCON_EVENTS[VIEW]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(FALCON_EVENTS[VIEW]!.label).toEqual(["thwart"]);
    expect(FALCON_EVENTS[AWAY]!.trigger).toMatchObject({
      kind: "response",
      forced: false,
      form: "hero",
      on: { on: "boostCardGiven", activation: "attack" },
    });
    expect(FALCON_EVENTS[AWAY]!.label).toEqual(["defense"]);
  });
  it("the printed data names exactly these refs, with costs 2, 2 and 0, all Aerial", () => {
    for (const [code, ref, cost] of [
      ["53003", BIRD, 2],
      ["53004", VIEW, 2],
      ["53005", AWAY, 0],
    ] as const) {
      expect(card(code).abilities.map((a) => a.id as string)).toEqual([ref]);
      expect(card(code).cost).toBe(cost);
      expect(card(code).traits.map(String)).toContain("AERIAL");
    }
  });
  it("Q6: the discard option's condition is the one switch for both cards, currently always true (B)", () => {
    expect(DISCARD_OPTION_OFFERED_WHEN).toEqual(allOf());
    for (const ref of [BIRD, VIEW]) {
      const found = FALCON_EVENTS[ref]!.effects.find((e) => e.kind === "chooseOne");
      if (found?.kind !== "chooseOne") throw new Error("no chooseOne");
      const chooseOne = found;
      expect(chooseOne.options[0]!.condition).toBe(DISCARD_OPTION_OFFERED_WHEN);
      expect(chooseOne.options[1]!.condition).toBeUndefined();
    }
  });
});

describe(`${BIRD} (Bird of Prey 53003): 4 damage to an enemy, an optional discard adds 1 per icon`, () => {
  it("costs 2: the event and the Energy that paid for it are in the discard pile", () => {
    const { state, event, payment } = bird([THREE], { discard: false });
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([event, payment]));
    expect(playerDiscardCodes(state)).toEqual(expect.arrayContaining(["53003", ENERGY]));
  });
  it("declining the discard: exactly 4 damage, the top card stays on the deck", () => {
    const s = withTop(falconHeroGame(), THREE);
    const top = deckOf(s)[0]!;
    const { state, events } = playEvent(s, "53003", { discard: false });
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(attacks(events)).toMatchObject([{ event: { amount: 4, basic: false } }]);
    expect(deckOf(state)[0]).toBe(top);
  });
  it.each([
    ["0 icons", ZERO, 4],
    ["1 icon", ONE, 5],
    ["2 icons", TWO, 6],
    ["3 icons", THREE, 7],
    ["a star and no boost icon (the star counts as 1)", STAR, 5],
  ])("discarding a top card of %s: one attack of 4 + icons, the card is discarded", (_name, code, total) => {
    const s = withTop(falconHeroGame(), code);
    const top = deckOf(s)[0]!;
    const { state, events } = playEvent(s, "53003", { discard: true });
    expect(inst(state, villainOf(state)).damage).toBe(total);
    expect(attacks(events)).toHaveLength(1);
    expect(attacks(events)).toMatchObject([{ event: { amount: total, basic: false } }]);
    expect(discardOf(state)).toContain(top);
    expect(deckOf(state)).not.toContain(top);
  });
  it("Q6: a faceup top card with no icons still offers the discard (B), for 0 additional", () => {
    const s = withTop(falconHeroGame(), ZERO);
    expect(faceVisible(s, deckOf(s)[0]!, { viewer: P1, deps: FALCON_DEPS })).toBe(true);
    const { seen, state } = playEvent(s, "53003", { discard: true });
    expect(seen.find((x) => x.kind === "chooseOption")!.labels).toEqual([
      "Discard the top card of the encounter deck",
      "Do not discard",
    ]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(discardOf(state)).toContain(deckOf(s)[0]!);
  });
  it("a faceup top card with icons offers both options", () => {
    const { seen } = bird([TWO]);
    expect(seen.find((x) => x.kind === "chooseOption")!.labels).toHaveLength(2);
  });
  it("a facedown top card (no identity script, so nothing keeps it faceup): the discard is offered and resolves for what it prints", () => {
    const s = withTop(falconHeroGame(), THREE);
    expect(faceVisible(s, deckOf(s)[0]!, { viewer: P1, deps: NO_FALCON_IDENTITY })).toBe(false);
    const { state, seen } = playEvent(s, "53003", { discard: true }, NO_FALCON_IDENTITY);
    expect(seen.find((x) => x.kind === "chooseOption")!.labels).toHaveLength(2);
    expect(inst(state, villainOf(state)).damage).toBe(7);
    const zero = playEvent(withTop(falconHeroGame(), ZERO), "53003", { discard: true }, NO_FALCON_IDENTITY);
    expect(zero.seen.find((x) => x.kind === "chooseOption")!.labels).toHaveLength(2);
    expect(inst(zero.state, villainOf(zero.state)).damage).toBe(4);
  });
  it("the faceup top card is the same card the player discards (the next one is then shown, not read)", () => {
    const s = withTop(falconHeroGame(), TWO, THREE);
    const second = deckOf(s)[1]!;
    const { state } = playEvent(s, "53003", { discard: true });
    expect(inst(state, villainOf(state)).damage).toBe(6);
    expect(deckOf(state)[0]).toBe(second);
  });
  it("Eagle-Eyed is offered after the event (it is Aerial) and discards the next top card when taken", () => {
    const s = withTop(falconHeroGame(), ONE, THREE);
    const [first, second] = deckOf(s) as [InstanceId, InstanceId];
    const { state, seen } = playEvent(s, "53003", { discard: true, eagle: true });
    expect(seen.some((x) => x.kind === "chooseTriggers" && x.labels.includes("Falcon"))).toBe(true);
    expect(discardOf(state)).toEqual(expect.arrayContaining([first, second]));
    expect(inst(state, villainOf(state)).damage).toBe(5);
  });
  it("a minion as the target: the damage goes to it, Rhino is untouched", () => {
    const s = engageMinion(withTop(falconHeroGame(), THREE), "01103", "shocker");
    const { state } = playEvent(s, "53003", { discard: true, target: "shocker" });
    expect(state.instances["shocker" as InstanceId]).toBeDefined();
    expect(playerOf(state, P1).playArea).not.toContain("shocker");
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  it("guard: with Hydra Mercenary engaged only it can be chosen, and Rhino takes nothing", () => {
    const s = engageMinion(withTop(falconHeroGame(), ONE), "01101", "merc");
    const { state, seen } = playEvent(s, "53003", { discard: true });
    expect(seen[0]!.labels).toEqual(["Hydra Mercenary"]);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).playArea).not.toContain("merc");
  });
  it("is a Hero Action: offered in hero form, not in alter-ego form", () => {
    const given = moveToHand(withTop(falconHeroGame(), ONE), P1, "53003");
    const ego = moveToHand(falconGame(), P1, "53003");
    const offered = (s: GameState, id: InstanceId): boolean => {
      const legal = legalActions(s, P1, FALCON_DEPS);
      if (legal.kind !== "turn") throw new Error(legal.kind);
      return legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
    };
    expect(offered(given.state, given.ids[0]!)).toBe(true);
    expect(offered(ego.state, ego.ids[0]!)).toBe(false);
  });
});

/** The main scheme set to `threat` (the default is small), and Falcon in hero form. */
const withThreat = (threat: number, ...top: readonly string[]): GameState => {
  const s = withTop(falconHeroGame(), ...top);
  return patchInstance(s, s.mainScheme.instanceId, { threat });
};

describe(`${VIEW} (Bird's-Eye View 53004): remove 3 threat from a scheme, an optional discard adds 1 per icon`, () => {
  it("costs 2: the event and the Energy that paid for it are in the discard pile", () => {
    const { state } = playEvent(withThreat(10, THREE), "53004", { discard: false });
    expect(playerDiscardCodes(state)).toEqual(expect.arrayContaining(["53004", ENERGY]));
  });
  it("declining the discard: exactly 3 threat removed, the top card stays", () => {
    const s = withThreat(10, THREE);
    const { state } = playEvent(s, "53004", { discard: false });
    expect(threatOf(state, state.mainScheme.instanceId)).toBe(7);
    expect(deckOf(state)[0]).toBe(deckOf(s)[0]);
  });
  it.each([
    ["0 icons", ZERO, 3],
    ["1 icon", ONE, 4],
    ["2 icons", TWO, 5],
    ["3 icons", THREE, 6],
    ["a star and no boost icon (the star counts as 1)", STAR, 4],
  ])(
    "discarding a top card of %s: %i threat removed from that scheme, the card is discarded",
    (_name, code, removed) => {
      const s = withThreat(10, code);
      const top = deckOf(s)[0]!;
      const { state } = playEvent(s, "53004", { discard: true });
      expect(threatOf(state, state.mainScheme.instanceId)).toBe(10 - removed);
      expect(discardOf(state)).toContain(top);
    },
  );
  it("Q6: a faceup top card with no icons still offers the discard (B), for 0 additional", () => {
    const s = withThreat(10, ZERO);
    expect(faceVisible(s, deckOf(s)[0]!, { viewer: P1, deps: FALCON_DEPS })).toBe(true);
    const { seen, state } = playEvent(s, "53004", { discard: true });
    expect(seen.find((x) => x.kind === "chooseOption")!.labels).toHaveLength(2);
    expect(threatOf(state, state.mainScheme.instanceId)).toBe(7);
  });
  it("a facedown top card (no identity script): the discard is offered and resolves for what it prints", () => {
    const { state, seen } = playEvent(withThreat(10, TWO), "53004", { discard: true }, NO_FALCON_IDENTITY);
    expect(seen.find((x) => x.kind === "chooseOption")!.labels).toHaveLength(2);
    expect(threatOf(state, state.mainScheme.instanceId)).toBe(5);
  });
  it("crisis: with Crowd Control in play, choosing it removes all of 3 + 2 from the side scheme", () => {
    const staged = encounterCardInVillainArea(withThreat(10, TWO), CROWD, 8);
    const { state, seen } = playEvent(staged.state, "53004", { discard: true, target: staged.id });
    expect(seen[0]!.kind).toBe("chooseTarget");
    expect(seen[0]!.labels).toContain("Crowd Control");
    expect(threatOf(state, staged.id)).toBe(3);
    expect(threatOf(state, state.mainScheme.instanceId)).toBe(10);
  });
  it("crisis: it is a thwart, so the main scheme loses nothing while Crowd Control is in play (3 and 3 + 2 both stop)", () => {
    for (const discard of [false, true]) {
      const staged = encounterCardInVillainArea(withThreat(10, TWO), CROWD, 8);
      const { state } = playEvent(staged.state, "53004", { discard, target: staged.state.mainScheme.instanceId });
      expect(threatOf(state, state.mainScheme.instanceId)).toBe(10);
      expect(threatOf(state, staged.id)).toBe(8);
    }
  });
});

/** A villain phase in which Rhino attacks Falcon (hero form), the boost card then the next card being these. */
function villainAttack(boost: string, next: string, plan: Plan, copies = 1, twoPlayers = false) {
  let s = falconHeroGame({ twoPlayers });
  s = withTop(s, boost, next, ZERO, ZERO);
  const given = moveToHand(s, P1, ...Array.from({ length: copies }, () => "53005"));
  const { pick, seen } = planned({ ...plan, keep: given.ids });
  const boostId = deckOf(s)[0]!;
  const nextId = deckOf(s)[1]!;
  const commands = twoPlayers ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)];
  const result = driveEventsPicking(FALCON_DEPS, given.state, pick, ...commands);
  return { ...result, seen, boostId, nextId, events: result.events, copies: given.ids, start: given.state };
}
const flipped = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.instanceId] : []));
/** Cards drawn between the response resolving and the next question: the hand at the prompt after the rearrange, plus the played copy. */
function drawn(seen: readonly Seen[]): number {
  const at = seen.findIndex((x) => x.kind === "rearrange");
  return seen[at + 1]!.handSize - seen[at]!.handSize;
}

describe(`${AWAY} (Up, Up, and Away 53005): look at the boost card and the deck top, swap, draw per printed icon`, () => {
  it("is offered when Rhino attacks Falcon and given a facedown boost card; the look shows both cards to Falcon's player only", () => {
    const run = villainAttack(ZERO, THREE, { away: ["keep"] }, 1, true);
    const look = run.seen.find((x) => x.kind === "rearrange")!;
    expect(look.labels).toEqual(["Armored Rhino Suit", "Sonic Converter"]);
    const see = (id: InstanceId, viewer: typeof P1) => faceVisible(look.state, id, { viewer, deps: FALCON_DEPS });
    expect([see(run.boostId, P1), see(run.nextId, P1)]).toEqual([true, true]);
    expect([see(run.boostId, P2), see(run.nextId, P2)]).toEqual([false, false]);
    expect(lookedAtBy(look.state, P1)).toEqual([run.boostId, run.nextId]);
    expect(lookedAtBy(look.state, P2)).toEqual([]);
  });
  it("a boost card of 0 icons swapped with a top card of 3: 3 cards drawn, the attack turns up the 3-icon card", () => {
    const run = villainAttack(ZERO, THREE, { away: ["swap"] });
    expect(drawn(run.seen)).toBe(3);
    expect(flipped(run.events)).toEqual([run.nextId]);
    expect(deckOf(run.seen.at(-1)!.state)[0]).toBe(run.boostId);
  });
  it("the same cards, looked at and not swapped: 0 cards drawn, the attack turns up the card it was given", () => {
    const run = villainAttack(ZERO, THREE, { away: ["keep"] });
    expect(drawn(run.seen)).toBe(0);
    expect(flipped(run.events)).toEqual([run.boostId]);
  });
  it("not swapped, the boost card has 2 icons: 2 drawn for that card", () => {
    const run = villainAttack(TWO, ZERO, { away: ["keep"] });
    expect(drawn(run.seen)).toBe(2);
  });
  it("swapped, the boost card now being the 1-icon card: 1 drawn (the old boost card's 2 icons do not count)", () => {
    const run = villainAttack(TWO, ONE, { away: ["swap"] });
    expect(drawn(run.seen)).toBe(1);
  });
  it("a star counts as an icon: a boost card of 1 star and no boost icon draws 1", () => {
    expect(drawn(villainAttack(STAR, THREE, { away: ["keep"] }).seen)).toBe(1);
    expect(drawn(villainAttack(ZERO, STAR, { away: ["swap"] }).seen)).toBe(1);
  });
  it("the event costs nothing and is spent: it is in the discard pile after, whichever way", () => {
    const run = villainAttack(ONE, ONE, { away: ["keep"] });
    const last = run.seen.at(-1)!.state;
    expect(playerOf(last, P1).discard).toContain(run.copies[0]);
    expect(playerOf(last, P1).hand).not.toContain(run.copies[0]);
  });
  it("declined: nothing is looked at or drawn, and the boost card is turned up as dealt", () => {
    const run = villainAttack(THREE, ZERO, { away: ["decline"] });
    expect(run.seen.some((x) => x.kind === "rearrange")).toBe(false);
    expect(flipped(run.events)).toEqual([run.boostId]);
  });
  it("the (defense) label: Falcon is the defender, and the declare-defender step still offers a basic defense", () => {
    const run = villainAttack(ZERO, THREE, { away: ["swap"] });
    const declare = run.seen.find((x) => x.kind === "declareDefender")!;
    expect(declare.labels).toEqual(["No defense", "Falcon"]);
    // The step is answered with "decline" (firstLegal): Rhino's ATK 2 and the 3-icon card turned up hit Falcon.
    expect(heroDamage(run.state)).toBe(5);
  });
  it("not offered for a scheme's boost card: only the attack on Falcon opens it (Spider-Man, in alter-ego form, is schemed against)", () => {
    const run = villainAttack(ONE, ONE, { away: ["decline", "keep"] }, 1, true);
    const offers = run.seen.filter((x) => x.kind === "chooseTriggers" && x.labels.includes("Up, Up, and Away"));
    expect(offers).toHaveLength(1);
  });
  it("Q34 (built as A): two copies may each answer the same boost card; the second looks at the cards as the first left them", () => {
    const run = villainAttack(ZERO, THREE, { away: ["swap", "keep"] }, 2);
    const looks = run.seen.filter((x) => x.kind === "rearrange");
    expect(looks).toHaveLength(2);
    // First look: boost Suit, top Sonic Converter. After the swap the second sees Sonic Converter as the boost card.
    expect(looks[0]!.labels).toEqual(["Armored Rhino Suit", "Sonic Converter"]);
    expect(looks[1]!.labels).toEqual(["Sonic Converter", "Armored Rhino Suit"]);
    const afterSecond = run.seen[run.seen.indexOf(looks[1]!) + 1]!;
    const afterFirst = run.seen[run.seen.indexOf(looks[0]!) + 1]!;
    expect(afterFirst.handSize - looks[0]!.handSize).toBe(3);
    // The second copy leaves the hand: 3 more cards for the 3-icon boost card, minus the copy that was played.
    expect(afterSecond.handSize - looks[1]!.handSize).toBe(3);
    expect(flipped(run.events)).toEqual([run.nextId]);
  });
});
