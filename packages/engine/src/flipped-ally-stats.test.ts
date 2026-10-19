/**
 * A double-sided ally's printed THW, ATK and hit points are those of the face it shows (`CardFlipSide.thw` / `atk` /
 * `hp`): the profile readers go through `printedProfile`, which follows `flipped`, as name, traits and
 * resource icons do. A stat the other face does not print reads the front's.
 *
 * Synthetic cards: an ally printing THW 2 / ATK 1 / 3 hit points whose other face prints THW 1 / ATK 2 (Typhoid Mary /
 * Bloody Mary, `fne` 60210a/b, in shape); one whose other face prints ATK — and 5 hit points; one whose other face
 * prints no stats of its own.
 *
 * Sources: RRG 1.8 "Flip" (p. 20), "Printed" (p. 35), "Double-Sided Card" (p. 17).
 */

import type { AllyCard, AnyCard, CardFlipSide, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import {
  baseStat,
  characterProfile,
  mustInstance,
  printedHpNumeral,
  printedProfile,
  showingAllyStats,
} from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

const twoFaced = (id: string, back: Partial<Pick<CardFlipSide, "thw" | "atk" | "hp">>): AllyCard => ({
  ...stubAlly({ id, cost: 0, thw: 2, atk: 1, hp: 3 }),
  flipSide: {
    name: `${id}-back`,
    traits: [],
    keywords: [],
    text: { printed: "", current: "" },
    abilities: [],
    ...back,
  },
});
/** THW 2 / ATK 1 on the front, THW 1 / ATK 2 on the other face; 3 hit points on both. */
const MARY = twoFaced("mary", { thw: 1, atk: 2 });
/** The other face prints ATK — (cannot attack) and 5 hit points; THW reads the front's 2. */
const DASH = twoFaced("dash", { atk: null, hp: 5 });
/** The other face prints no stats of its own. */
const SAME = twoFaced("same", {});

const deps: EngineDeps = depsOf();
const CARDS: readonly AnyCard[] = [MARY, DASH, SAME];

/** p1's first turn with `card` in play, showing its other face when `flipped`. */
function inPlay(card: string, flipped: boolean): { readonly state: GameState; readonly id: InstanceId } {
  const start = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.flatMap((c) => copiesOf(c.id, 3)) });
  const put = playerCardIntoPlay(start, card as CardId);
  if (!flipped) return put;
  const instances = { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), flipped: true } };
  return { state: { ...put.state, instances }, id: put.id };
}

describe("a flipped double-sided ally's printed stats", () => {
  it("reads the other face's THW and ATK while flipped, the front's while not (Typhoid Mary / Bloody Mary)", () => {
    const front = inPlay("mary", false);
    expect(printedProfile(front.state, front.id)).toMatchObject({ thw: 2, atk: 1, maxHp: 3, missing: [] });
    const back = inPlay("mary", true);
    expect(printedProfile(back.state, back.id)).toMatchObject({ thw: 1, atk: 2, maxHp: 3, missing: [] });
    expect(characterProfile(back.state, back.id, deps)).toMatchObject({ thw: 1, atk: 2, maxHp: 3 });
    expect([baseStat(back.state, back.id, "thw", deps), baseStat(back.state, back.id, "atk", deps)]).toEqual([1, 2]);
  });

  it("a face's printed dash and hit points apply; a stat it does not print reads the front's", () => {
    const back = inPlay("dash", true);
    expect(printedProfile(back.state, back.id)).toMatchObject({ thw: 2, atk: 0, maxHp: 5, missing: ["atk"] });
    expect(printedHpNumeral(back.state, back.id)).toBe(5);
    const same = inPlay("same", true);
    expect(printedProfile(same.state, same.id)).toMatchObject({ thw: 2, atk: 1, maxHp: 3, missing: [] });
  });

  it("an ally treated as a minion reads the face it shows (SCH from its printed THW)", () => {
    const back = inPlay("mary", true);
    const treatedAs = {
      kind: "minion",
      traits: [],
      keepPrintedTraits: true,
      schFromThw: true,
      source: back.id,
      controllerBefore: null,
    } as const;
    const instances = { ...back.state.instances, [back.id]: { ...mustInstance(back.state, back.id), treatedAs } };
    const treated: GameState = { ...back.state, instances };
    expect(printedProfile(treated, back.id)).toMatchObject({ kind: "minion", atk: 2, sch: 1, maxHp: 3 });
  });

  it("showingAllyStats: the front's stats unflipped, and when the card has no other face", () => {
    expect(showingAllyStats(MARY, false)).toEqual({ thw: 2, atk: 1, hp: 3 });
    expect(showingAllyStats(MARY, true)).toEqual({ thw: 1, atk: 2, hp: 3 });
    expect(showingAllyStats(stubAlly({ id: "plain", cost: 0, thw: 1, atk: 1, hp: 2 }), true)).toEqual({
      thw: 1,
      atk: 1,
      hp: 2,
    });
  });
});
