/**
 * A double-sided attachment's printed stat boxes are those of the face it shows (`CardFlipSide.statModifiers`): Dense
 * (+1 ATK) flips to Intangible (+1 SCH), `synthezoid` 57046a/b. The showing face's set replaces the front's whole (a
 * box the face does not print is not inherited); a face with no `statModifiers` of its own prints the front's.
 *
 * Synthetic cards: an attachment printing +1 ATK whose other face prints +1 SCH; one whose other face prints no stat
 * box (`{}`); one whose other face does not differ (no field).
 *
 * Sources: RRG 1.8 "Flip" (p. 20), "Printed" (p. 35), "Double-Sided Card" (p. 17).
 */

import type { AttachmentCard, CardFlipSide, CardId, PrintedStatModifiers } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { modifiersFor } from "./modifiers.js";
import { activeVillain, characterStat, mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAttachment } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn } from "./testing/wave3.js";

const twoFaced = (id: string, back: PrintedStatModifiers | undefined): AttachmentCard => {
  const flipSide: CardFlipSide = {
    name: `${id}-back`,
    traits: [],
    keywords: [],
    text: { printed: "", current: "" },
    abilities: [],
    ...(back ? { statModifiers: back } : {}),
  };
  return { ...stubAttachment({ id, attachesTo: { kind: "villain" }, statModifiers: { atk: 1 } }), flipSide };
};
/** +1 ATK on the front, +1 SCH on the other face (Dense / Intangible in shape). */
const DENSE = twoFaced("dense", { sch: 1 });
/** The other face prints no stat box. */
const BARE = twoFaced("bare", {});
/** The other face prints the front's (no field). */
const SAME = twoFaced("same", undefined);

const deps: EngineDeps = depsOf();

/** The villain with `card` attached (surgery), showing its other face when `flipped`. */
function attached(card: AttachmentCard, flipped: boolean): { readonly state: GameState; readonly villain: InstanceId } {
  const start = gameAtFirstTurn({ cards: [card], deps, encounter: copiesOf(card.id as CardId, 1) });
  const put = encounterCardInVillainArea(start, card.id as CardId);
  const villain = activeVillain(put.state).instanceId;
  const host = mustInstance(put.state, villain);
  const state: GameState = {
    ...put.state,
    villainArea: put.state.villainArea.filter((id) => id !== put.id),
    instances: {
      ...put.state.instances,
      [put.id]: { ...mustInstance(put.state, put.id), attachedTo: villain, flipped },
      [villain]: { ...host, attachments: [...host.attachments, put.id] },
    },
  };
  return { state, villain };
}

const printed = (state: GameState, villain: InstanceId) =>
  modifiersFor(state, deps, villain)
    .filter((m) => m.origin === "attachment")
    .map((m) => [m.stat, m.amount]);

describe("a flipped double-sided attachment's printed stat boxes", () => {
  it("applies the front's while unflipped and the showing face's whole set while flipped (Dense / Intangible)", () => {
    const front = attached(DENSE, false);
    expect(printed(front.state, front.villain)).toEqual([["atk", 1]]);
    const back = attached(DENSE, true);
    expect(printed(back.state, back.villain)).toEqual([["sch", 1]]);
    const stat = (at: typeof front, s: "atk" | "sch") => characterStat(at.state, at.villain, s, deps) ?? NaN;
    expect([stat(back, "atk"), stat(back, "sch")]).toEqual([stat(front, "atk") - 1, stat(front, "sch") + 1]);
  });

  it("a face printing no stat box gives none; a face with no field of its own prints the front's", () => {
    const bare = attached(BARE, true);
    expect(printed(bare.state, bare.villain)).toEqual([]);
    const same = attached(SAME, true);
    expect(printed(same.state, same.villain)).toEqual([["atk", 1]]);
  });
});
