/**
 * docs/phase7-wave4.md §3.33: "an attachment with the text 'Hero Action' or 'Hero Response'" (Phase Disruption,
 * `vision` 26011; Phase Strike, `mut_gen` 32038; Sunfire, `wolv` 35014; Target Lock, `cw` 56130). Synthetic attachments
 * with a Hero Action, a Hero Response, a Forced Response, and one whose text box is blanked.
 *
 * Sources: the cards' own text; RRG 1.8 "Action" (p. 6), "Response" (p. 38), "Forced" (p. 20), "Blank" (p. 10).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { selectTargets, timingWordOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubSupport } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const heroAction = stubAbility("gear.hero-action", {
  trigger: { kind: "action", form: "hero" },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const heroResponse = stubAbility("net.hero-response", {
  trigger: { kind: "response", forced: false, form: "hero", on: { on: "cardEntersPlay" } },
  effects: [],
});
const forcedResponse = stubAbility("spikes.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay" } },
  effects: [],
});
const attachment = (id: string, ability: { ref: { id: string } }) =>
  stubAttachment({ id, name: id, attachesTo: { kind: "villain" }, abilities: [ability.ref as never] });
const GEAR = attachment("gear", heroAction);
const NET = attachment("net", heroResponse);
const SPIKES = attachment("spikes", forcedResponse);
const WIPE = stubAbility("wipe.constant", {
  trigger: { kind: "constant", rules: [{ kind: "blankTextBox", target: { name: "net" } }] },
  effects: [],
});
const WIPE_CARD = stubSupport({ id: "wipe", cost: 0, abilities: [WIPE.ref] });
const deps: EngineDeps = depsOf(heroAction, heroResponse, forcedResponse, WIPE);

function start(): GameState {
  let state = gameAtFirstTurn({
    cards: [GEAR, NET, SPIKES, WIPE_CARD],
    deps,
    encounter: [GEAR.id, NET.id, SPIKES.id],
    deck: [WIPE_CARD.id],
  });
  for (const card of [GEAR, NET, SPIKES]) {
    const placed = encounterCardInVillainArea(state, card.id, 0);
    const villain = state.activeVillainId;
    state = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...placed.state.instances[placed.id]!, attachedTo: villain },
        [villain]: {
          ...placed.state.instances[villain]!,
          attachments: [...placed.state.instances[villain]!.attachments, placed.id],
        },
      },
    };
  }
  return state;
}
const names = (state: GameState, ids: readonly string[]) =>
  ids.map((id) => state.cardPool[state.instances[id as never]!.cardId]!.name).sort();
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

describe("§3.33 a card with the text 'Hero Action' or 'Hero Response'", () => {
  it("matches the attachments whose abilities carry those timing words, not a Forced Response", () => {
    const state = start();
    const found = selectTargets(
      state,
      { categories: ["attachment"], abilityTiming: ["heroAction", "heroResponse"] },
      context,
    );
    expect(names(state, found)).toEqual(["gear", "net"]);
    expect(
      names(state, selectTargets(state, { categories: ["attachment"], abilityTiming: ["forcedResponse"] }, context)),
    ).toEqual(["spikes"]);
  });

  it("a blanked text box has no text to match", () => {
    const state = playerCardIntoPlay(start(), WIPE_CARD.id).state;
    const found = selectTargets(state, { categories: ["attachment"], abilityTiming: ["heroResponse"] }, context);
    expect(found).toEqual([]);
  });

  it("maps each trigger shape to its printed timing word", () => {
    expect(timingWordOf({ kind: "action" })).toBe("action");
    expect(timingWordOf({ kind: "action", form: "alterEgo" })).toBe("alterEgoAction");
    expect(timingWordOf({ kind: "interrupt", forced: false, form: "hero", on: { on: "cardEntersPlay" } })).toBe(
      "heroInterrupt",
    );
    expect(timingWordOf({ kind: "interrupt", forced: true, on: { on: "cardEntersPlay" } })).toBe("forcedInterrupt");
    expect(timingWordOf({ kind: "resource", form: "hero" })).toBe("heroResource");
    expect(timingWordOf({ kind: "whenRevealed" })).toBeNull();
  });
});
