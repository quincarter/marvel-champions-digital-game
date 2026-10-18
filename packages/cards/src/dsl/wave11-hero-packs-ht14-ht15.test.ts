/**
 * docs/phase7-wave11-hero-packs.md HT14 (§H3.20) and HT15 (§H3.21): the DSL's vocabulary.
 *
 * HT14, `namedByTeamUpOf(ref)`: Dynamic Duo 62022, "Search your deck and discard pile for a Team-Up card and an ally
 * named by that card's Team-Up keyword. Add those cards to your hand. (Shuffle.)", in a hand-built Luke Cage deck
 * against Core's Rhino. The script is this test's own (the pack's basic module scripts the card). Power Man and Iron
 * Fist 62023 ("Team-Up (Iron Fist and Luke Cage)") is found in the discard pile, then Iron Fist 62012 (subtitle Danny
 * Rand) in the deck; Misty Knight 62013 is never offered, and Unbreakable Bond 62024 ("Team-Up (Jessica Jones and Luke
 * Cage)") names no ally in the deck. RRG 1.8 "Team-Up" (p. 43): a character is named by its title or subtitle.
 *
 * HT15, `hasPrintedBoostAbility`: the fragment's shape; the engine's `prints-boost-ability-query.test.ts` drives it.
 */

import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import { P1, firstLegal, inst, moveToHand, payWith, play, playerOf, runWith, settle } from "../testing/harness.js";
import type { Picker } from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { WAVE11_ABILITIES, WAVE11_CARDS } from "../wave11/index.js";
import { action } from "./abilities.js";
import { cards, chooseCards, moveCards, shuffleDeck, zone } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { TEAM_UP_CARD, chosen, hasPrintedBoostAbility, namedByTeamUpOf, query, you } from "./values.js";

vi.setConfig({ testTimeout: 120_000 });

const DYNAMIC_DUO_REF = "62022.dynamic-duo-action";
const DYNAMIC_DUO = "62022";
const POWER_MAN_AND_IRON_FIST = "62023";
const UNBREAKABLE_BOND = "62024";
const IRON_FIST = "62012";
const MISTY_KNIGHT = "62013";
const FILLER = "01091"; // Avengers Mansion: one resource when paid with

const SEARCH = ["deck", "discard"] as const;
const SCRIPT = action(
  chooseCards("teamUp", zone([...SEARCH], you, { filter: TEAM_UP_CARD }), { min: 1, max: 1 }),
  chooseCards("ally", zone([...SEARCH], you, { filter: query("ally", namedByTeamUpOf(chosen("teamUp"))) }), {
    min: 1,
    max: 1,
  }),
  moveCards(cards(chosen("teamUp")), "hand"),
  moveCards(cards(chosen("ally")), "hand"),
  shuffleDeck(),
);
const DEPS: EngineDeps = { abilities: { ...WAVE11_ABILITIES, [DYNAMIC_DUO_REF]: SCRIPT } };

/** Luke Cage in hero form, every named card out of his hand: the Team-Up events in the discard pile, allies in the deck. */
function lukeGame(): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const named = [DYNAMIC_DUO, POWER_MAN_AND_IRON_FIST, UNBREAKABLE_BOND, IRON_FIST, MISTY_KNIGHT];
  const deck = [...named, ...Array(35).fill(FILLER)];
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [{ identityCardId: cardId("62001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) }],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const state = withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
    { heroForm: 0 },
  );
  const idOf = (code: string) => Object.values(state.instances).find((i) => i.cardId === cardId(code))!.instanceId;
  const toDiscard = [POWER_MAN_AND_IRON_FIST, UNBREAKABLE_BOND].map(idOf);
  const toDeck = [IRON_FIST, MISTY_KNIGHT, DYNAMIC_DUO].map(idOf);
  const moved = [...toDiscard, ...toDeck];
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((i) => !moved.includes(i)),
      discard: [...p.discard.filter((i) => !moved.includes(i)), ...toDiscard],
      deck: [...toDeck, ...p.deck.filter((i) => !moved.includes(i))],
    })),
  };
}

/** Plays Dynamic Duo taking `teamUp` then whatever ally is offered first; records each search's offered cards. */
function played(teamUp: string) {
  const given = moveToHand(lukeGame(), P1, DYNAMIC_DUO);
  const duo = given.ids[0]!;
  const offers: string[][] = [];
  const codeOf = (s: GameState, id: string) => inst(s, id as InstanceId).cardId as string;
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "chooseCards") return firstLegal(s);
    const ids = choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : []));
    offers.push(ids.map((id) => codeOf(s, id)).sort());
    const wanted = offers.length === 1 ? ids.find((id) => codeOf(s, id) === teamUp) : ids[0];
    const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === wanted);
    return option ? [option.optionId] : firstLegal(s);
  };
  const command = play(P1, duo, payWith(given.state, P1, 2, [duo]));
  const state = settle(runWith(DEPS, given.state, command), pick, undefined, DEPS);
  const hand = playerOf(state, P1).hand.map((id) => codeOf(state, id));
  return { state, offers, hand };
}

describe("HT14 namedByTeamUpOf (Dynamic Duo 62022)", () => {
  it("is the engine's `titled.teamUpOf` over the ref, and the script validates", () => {
    expect(namedByTeamUpOf(chosen("teamUp"))).toEqual({ titled: { teamUpOf: { kind: "slot", slot: "teamUp" } } });
    expect(namedByTeamUpOf(chosen("teamUp"), 1)).toEqual({
      titled: { teamUpOf: { kind: "slot", slot: "teamUp" }, index: 1 },
    });
    expect(TEAM_UP_CARD).toEqual({ withKeyword: "teamUp" });
    expect(validateDefinition(SCRIPT)).toEqual([]);
  });

  it("Power Man and Iron Fist is found in the discard pile, then Iron Fist 62012 in the deck; both go to hand", () => {
    const { offers, hand } = played(POWER_MAN_AND_IRON_FIST);
    // First search: the two Team-Up cards, from the discard pile; no ally, no other card.
    expect(offers[0]).toEqual([POWER_MAN_AND_IRON_FIST, UNBREAKABLE_BOND]);
    // Second search: the ally the found card names, by title. Misty Knight is an ally it does not name.
    expect(offers[1]).toEqual([IRON_FIST]);
    expect(hand).toContain(POWER_MAN_AND_IRON_FIST);
    expect(hand).toContain(IRON_FIST);
    expect(hand).not.toContain(MISTY_KNIGHT);
  });

  it("control: Unbreakable Bond names Jessica Jones and Luke Cage, so no ally is offered and only it is found", () => {
    const { offers, hand } = played(UNBREAKABLE_BOND);
    expect(offers[0]).toEqual([POWER_MAN_AND_IRON_FIST, UNBREAKABLE_BOND]);
    expect(offers[1] ?? []).toEqual([]);
    expect(hand).toContain(UNBREAKABLE_BOND);
    expect(hand).not.toContain(IRON_FIST);
  });
});

describe("HT15 hasPrintedBoostAbility (Sidewinder 62033)", () => {
  it("is the engine's printed-Boost query field", () => {
    expect(hasPrintedBoostAbility).toEqual({ printsBoostAbility: true });
    expect(query("treachery", hasPrintedBoostAbility)).toEqual({
      categories: ["treachery"],
      printsBoostAbility: true,
    });
  });
});
