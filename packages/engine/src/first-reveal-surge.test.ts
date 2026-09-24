/**
 * docs/phase7-wave3.md §3.8: `RuleSpec firstRevealGainsSurge` and the round's reveal history. Synthetic cards shaped like
 * Nebula I–III ("The first [Technique] attachment revealed each round gains surge", `gmw` 16088–16090) and Mister Knife
 * ("The first treachery the engaged player reveals each villain phase gains surge", `stld` 17026).
 *
 * Sources: RRG 1.8 "Reveal" (p. 37), "Surge" (p. 42); FAQ "Mister Knife (#26)" (RRG 1.8 p. 62).
 */

import { flat, trait, type AttachmentCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, onTopOfEncounterDeck, P1, P2 } from "./testing/wave3.js";

const TECHNIQUE = trait("Technique");

/** Nebula: "The first [Technique] attachment revealed each round gains surge." */
const NEBULA_RULE = stubAbility("nebula.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "firstRevealGainsSurge",
        cards: { categories: ["attachment"], trait: TECHNIQUE },
        each: "round",
      },
    ],
  },
  effects: [],
});
const NEBULA = stubVillain({ id: "nebula", stages: [{ hp: flat(30), atk: 1, sch: 1, abilities: [NEBULA_RULE.ref] }] });
const technique = (id: string): AttachmentCard => ({
  ...stubAttachment({ id, attachesTo: { kind: "villain" } }),
  traits: [TECHNIQUE],
});
const STANCE = technique("stance");
const AMBITION = technique("ambition");

/** Mister Knife: "The first treachery the engaged player reveals each villain phase gains surge." */
const KNIFE_RULE = stubAbility("knife.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "firstRevealGainsSurge",
        cards: { categories: ["treachery"] },
        each: "phase",
        revealer: { kind: "controller" },
      },
    ],
  },
  effects: [],
});
const KNIFE = stubMinion({ id: "knife", atk: 2, sch: 2, hp: 6, abilities: [KNIFE_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
/** Shadow of the Past's shape: "When Revealed: put [Mister Knife] into play engaged with you." */
const SUMMON_REVEALED = stubAbility("summon.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "selectCards", slot: "knife", cards: { kind: "encounter", zones: ["deck"], filter: { name: KNIFE.name } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "knife" }, controller: { kind: "controller" } },
  ],
});
const SUMMON = stubTreachery({ id: "summon", boostIcons: 0, abilities: [SUMMON_REVEALED.ref] });

const deps: EngineDeps = depsOf(NEBULA_RULE, KNIFE_RULE, SUMMON_REVEALED);
const CARDS = [NEBULA, STANCE, AMBITION, KNIFE, BLANK, FILLER, SUMMON];
const ENCOUNTER: readonly CardId[] = [
  STANCE.id,
  ...copiesOf(AMBITION.id, 2),
  KNIFE.id,
  SUMMON.id,
  ...copiesOf(FILLER.id, 6),
  ...copiesOf(BLANK.id, 20),
];

/** Stacks the encounter deck so its top cards are `cards`, in order (surgery). */
function stacked(state: GameState, cards: readonly CardId[]): GameState {
  return [...cards].reverse().reduce((current, card) => onTopOfEncounterDeck(current, card), state);
}

/** Plays out the villain phase and returns every reveal and surge grant, in order. */
function villainPhase(state: GameState, players: readonly PlayerId[] = [P1]) {
  const { session, events } = driveSession(
    startSession(state),
    deps,
    players.map((playerId) => ({ type: "endTurn", playerId })),
  );
  const revealed = events.flatMap((event: GameEvent) =>
    event.type === "encounterCardRevealed" ? [String(event.cardId)] : [],
  );
  const granted = events.filter((event) => event.type === "surgeGranted").length;
  return { session, revealed, granted };
}

describe("§3.8 'The first … revealed each round gains surge' (Nebula)", () => {
  const start = (): GameState => gameAtFirstTurn({ cards: CARDS, deps, villain: NEBULA, encounter: ENCOUNTER });

  it("the first Technique revealed this round surges; the second does not", () => {
    // The villain's boost draw takes the filler; p1 is dealt the stance, which surges into the ambition.
    const { revealed, granted } = villainPhase(stacked(start(), [FILLER.id, STANCE.id, AMBITION.id, BLANK.id]));
    expect(revealed).toEqual(["stance", "ambition"]);
    expect(granted).toBe(1);
  });

  it("a card that is not a Technique neither surges nor counts as the first", () => {
    const { revealed } = villainPhase(stacked(start(), [FILLER.id, BLANK.id, STANCE.id]));
    expect(revealed).toEqual(["blank"]);
  });

  it("the count starts again each round", () => {
    const first = villainPhase(stacked(start(), [FILLER.id, STANCE.id, AMBITION.id, BLANK.id]));
    expect(first.session.state.revealedThisRound).toEqual([]);
    const second = villainPhase(stacked(first.session.state, [FILLER.id, AMBITION.id, BLANK.id]));
    expect(second.revealed[0]).toBe("ambition");
    expect(second.granted).toBe(1);
  });
});

describe("§3.8 'The first treachery the engaged player reveals each villain phase gains surge' (Mister Knife)", () => {
  const start = (players: 1 | 2): GameState => gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, players });

  it("the engaged player's first treachery surges; the one it surges into does not", () => {
    const state = minionEngagedWith(start(1), KNIFE.id).state;
    const { revealed, granted } = villainPhase(stacked(state, [FILLER.id, BLANK.id, BLANK.id, BLANK.id]));
    expect(revealed).toEqual(["blank", "blank"]);
    expect(granted).toBe(1);
  });

  it("another player's reveals are not the engaged player's", () => {
    const state = minionEngagedWith(start(2), KNIFE.id, P2).state;
    // Two boost draws (the villain activates once per player), then p1's card, then p2's, then p2's surge.
    const { revealed, granted } = villainPhase(
      stacked(state, [FILLER.id, FILLER.id, BLANK.id, BLANK.id, BLANK.id, BLANK.id]),
      [P1, P2],
    );
    expect(granted).toBe(1);
    expect(revealed).toEqual(["blank", "blank", "blank"]);
  });

  it("a card revealed before the rule's card was in play does not gain surge from it (FAQ, RRG 1.8 p. 62)", () => {
    const { revealed, granted } = villainPhase(stacked(start(1), [FILLER.id, SUMMON.id, BLANK.id]));
    expect(revealed).toEqual(["summon"]);
    expect(granted).toBe(0);
  });

  it("replays to the same state", () => {
    const state = minionEngagedWith(start(1), KNIFE.id).state;
    const { session } = villainPhase(stacked(state, [FILLER.id, BLANK.id, BLANK.id, BLANK.id]));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
