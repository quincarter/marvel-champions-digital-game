import { activeEncounterDeck, characterProfile, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  inst,
  moveToHand,
  playerOf,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { ELEKTRA_PROTECTION as REGISTRY, ELEKTRA_PROTECTION_SKIPPED as SKIPPED } from "./protection.js";
import { SANDMAN, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/protection`: Moon Knight 63039 in the deck of Core's Black Panther, against Rhino (ATK 2). Sandman
 * (2 boost icons) is Rhino's boost card, so an undefended-by-text attack on Moon Knight (5 hit points) deals 4. Each
 * line resolves once if a resource of its type was spent, every qualifying line resolves (rules expert, as Husk 47012).
 */
const MOON_KNIGHT = "63039";
const REF = "63039.moon-knight-interrupt";
const ENERGY = "01088";
const MENTAL = "01089";
const PHYSICAL = "01090";
const ADVANCE = "01186"; // Core treachery, boost 0

/** Moon Knight in play, a hand of exactly the `resources` codes, Sandman on top of the encounter deck. */
function setup(...resources: readonly string[]) {
  const game = elektraAspectGame(MOON_KNIGHT, "core-black-panther-protection");
  const emptied: GameState = {
    ...game,
    players: game.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.hand, ...p.deck] } : p)),
  };
  const knight = stagedInPlay(emptied, MOON_KNIGHT);
  let state = knight.state;
  const hand: InstanceId[] = [];
  for (const code of resources) {
    const given = moveToHand(state, P1, code);
    state = given.state;
    hand.push(...given.ids);
  }
  const stacked = stackEncounterDeck(state, SANDMAN, ADVANCE, ADVANCE);
  return { state: stacked, knight: knight.id, hand, sandman: activeEncounterDeck(stacked).deck[0]! };
}

/** Ends the turn: Moon Knight defends Rhino's attack, takes his interrupt when `use`, and pays with `pay`. */
function defend(b: ReturnType<typeof setup>, use: boolean, pay: readonly InstanceId[] = b.hand, boostPick?: string) {
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (boostPick && ids.includes(boostPick)) return [boostPick];
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = ids.find((i) => i.endsWith(REF));
      return use && hit ? [hit] : firstLegal(s);
    }
    if (choice.prompt.kind === "payForAbility") return ids.filter((i) => pay.some((id) => i === `hand:${id}`));
    const defender = ids.find((i) => i.endsWith(b.knight));
    return defender ? [defender] : firstLegal(s);
  };
  const run = driveEventsPicking(DEPS, b.state, pick, endTurn(P1));
  // Only Rhino's attack: the Advance revealed later makes him scheme with a boost card of its own.
  const flipped = run.events.flatMap((e: GameEvent) =>
    e.type === "boostCardFlipped" && e.instanceId === b.sandman ? [e.instanceId] : [],
  );
  const discarded = run.events.flatMap((e: GameEvent) =>
    e.type === "boostCancelled" && e.scope === "discarded" ? [e.instanceId] : [],
  );
  return { ...run, flipped, discarded };
}
const rhino = (s: GameState) => inst(s, s.activeVillainId!);

describe("registry", () => {
  it("registers Moon Knight's interrupt, skips nothing, and it validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY)).toEqual([REF]);
    expect(validateDefinition(REGISTRY[REF]!)).toEqual([]);
    expect(REGISTRY[REF]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
  });
});

describe("63039 Moon Knight: when he defends, spend up to 3 resources; a line per type spent", () => {
  it("declined: he takes Rhino's 2 + Sandman's 2", () => {
    const b = setup(ENERGY);
    const { state, flipped, discarded } = defend(b, false);
    expect(flipped).toEqual([b.sandman]);
    expect(discarded).toEqual([]);
    expect(inst(state, b.knight).damage).toBe(4);
    expect(playerOf(state, P1).hand).toEqual(expect.arrayContaining(b.hand));
  });

  it("[energy]: prevents 2 of the attack's damage", () => {
    const b = setup(ENERGY);
    const { state } = defend(b, true);
    expect(inst(state, b.knight).damage).toBe(2);
    expect(rhino(state).damage).toBe(0);
  });

  it("[mental]: Rhino's facedown boost card is discarded unturned, so it adds nothing", () => {
    const b = setup(MENTAL);
    const { state, flipped, discarded } = defend(b, true);
    expect(discarded).toEqual([b.sandman]);
    expect(flipped).toEqual([]);
    expect(activeEncounterDeck(state).discard).toContain(b.sandman);
    expect(inst(state, b.knight).damage).toBe(characterProfile(state, state.activeVillainId!, DEPS)!.atk);
    expect(inst(state, b.knight).damage).toBe(2);
  });

  it("[physical]: deals 2 damage to Rhino; Moon Knight still takes 4", () => {
    const b = setup(PHYSICAL);
    const { state } = defend(b, true);
    expect(rhino(state).damage).toBe(2);
    expect(inst(state, b.knight).damage).toBe(4);
  });

  it("all three types: each line once — boost card discarded, 2 prevented of 2, 2 damage to Rhino", () => {
    const b = setup(ENERGY, MENTAL, PHYSICAL);
    const { state, flipped, discarded } = defend(b, true);
    expect(discarded).toEqual([b.sandman]);
    expect(flipped).toEqual([]);
    expect(inst(state, b.knight).damage).toBe(0);
    expect(rhino(state).damage).toBe(2);
    // Spent (the hand refills at the end of the turn with other cards).
    for (const id of b.hand) expect(playerOf(state, P1).discard).toContain(id);
  });

  it("two of one type resolve its line once: [energy][energy] prevents 2, not 4", () => {
    const b = setup(ENERGY, ENERGY);
    const { state } = defend(b, true);
    expect(inst(state, b.knight).damage).toBe(2);
  });
});

describe("63039 Moon Knight [mental] with two facedown boost cards on the attacker (owner decision 7)", () => {
  /** An Advance (boost 0) already waiting facedown on Rhino before his activation gives him Sandman (surgery). */
  function twoCards() {
    const b = setup(MENTAL);
    const deckId = Object.keys(b.state.encounterDecks)[0]!;
    const piles = b.state.encounterDecks[deckId]!;
    const early = piles.deck[1]!;
    const rhinoId = b.state.activeVillainId!;
    const state: GameState = {
      ...b.state,
      encounterDecks: {
        ...b.state.encounterDecks,
        [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== early) },
      },
      instances: {
        ...b.state.instances,
        [early]: { ...inst(b.state, early), faceup: false },
        [rhinoId]: { ...inst(b.state, rhinoId), boostCards: [early] },
      },
    };
    return { b: { ...b, state }, early };
  }

  it("the controller is asked; the first dealt is the first option, and taking it leaves Sandman to flip", () => {
    const { b, early } = twoCards();
    const { state, flipped, discarded } = defend(b, true, b.hand, "boost:1");
    expect(discarded).toEqual([early]);
    expect(flipped).toEqual([b.sandman]);
    // Rhino's 2 + Sandman's 2: the boost-0 card was the one discarded.
    expect(inst(state, b.knight).damage).toBe(4);
  });

  it("picking the second (Sandman, dealt by the activation) discards it: the Advance flips for 0, he takes 2", () => {
    const { b, early } = twoCards();
    const { state, flipped, discarded } = defend(b, true, b.hand, "boost:2");
    expect(discarded).toEqual([b.sandman]);
    expect(flipped).toEqual([]);
    expect(inst(state, early).faceup).toBe(true);
    expect(inst(state, b.knight).damage).toBe(2);
  });
});
