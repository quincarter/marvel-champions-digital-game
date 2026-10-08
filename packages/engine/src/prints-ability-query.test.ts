/**
 * docs/phase7-wave8.md §3.77: "an attachment with the text 'Hero Action' or 'Hero Response'" as a fact about what the
 * card prints (`TargetQuery.printsAbility`). Synthetic attachments on the villain, one per label, a player upgrade on
 * the villain, and a constant that blanks one attachment's text box.
 *
 * Sources: RRG 1.8 "Ability" (pp. 4–5: the bold label names the ability's type and form), "Attachment" (p. 8),
 * "Printed" (p. 35), "Forced" (p. 20).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { explainQuery, selectTargets } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ENTERS = { on: "cardEntersPlay" } as const;
const heroAction = stubAbility("gear.hero-action", { trigger: { kind: "action", form: "hero" }, effects: [] });
const heroResponse = stubAbility("net.hero-response", {
  trigger: { kind: "response", forced: false, form: "hero", on: ENTERS },
  effects: [],
});
const forcedResponse = stubAbility("spikes.forced-response", {
  trigger: { kind: "response", forced: true, on: ENTERS },
  effects: [],
});
const heroInterrupt = stubAbility("stakes.hero-interrupt", {
  trigger: { kind: "interrupt", forced: false, form: "hero", on: ENTERS },
  effects: [],
});
const plainAction = stubAbility("wrap.action", { trigger: { kind: "action" }, effects: [] });
const plainResponse = stubAbility("restraint.response", {
  trigger: { kind: "response", forced: false, on: ENTERS },
  effects: [],
});
const alterEgoAction = stubAbility("cuffs.alter-ego-action", {
  trigger: { kind: "action", form: "alterEgo" },
  effects: [],
});
const upgradeAction = stubAbility("frost.hero-action", { trigger: { kind: "action", form: "hero" }, effects: [] });
/** Blanks the Hero Response attachment's text box, as a constant. */
const WIPE = stubAbility("wipe.constant", {
  trigger: { kind: "constant", rules: [{ kind: "blankTextBox", target: { name: "net" } }] },
  effects: [],
});

const attachment = (id: string, ...abilities: { ref: { id: string } }[]) =>
  stubAttachment({ id, name: id, attachesTo: { kind: "villain" }, abilities: abilities.map((a) => a.ref as never) });
const GEAR = attachment("gear", heroAction);
const NET = attachment("net", heroResponse);
const SPIKES = attachment("spikes", forcedResponse);
const STAKES = attachment("stakes", heroInterrupt);
const WRAP = attachment("wrap", plainAction);
const RESTRAINT = attachment("restraint", plainResponse);
const CUFFS = attachment("cuffs", alterEgoAction);
const DRAIN = attachment("drain");
/** A card data ref with no script behind it: nothing in the registry says what it prints. */
const GHOST = stubAttachment({
  id: "ghost",
  name: "ghost",
  attachesTo: { kind: "villain" },
  abilities: [{ id: "ghost.unscripted" } as never],
});
const ENCOUNTER = [GEAR, NET, SPIKES, STAKES, WRAP, RESTRAINT, CUFFS, DRAIN, GHOST];
const FROST = stubUpgrade({ id: "frost", cost: 0, abilities: [upgradeAction.ref] });
const WIPE_CARD = stubSupport({ id: "wipe", cost: 0, abilities: [WIPE.ref] });

const deps: EngineDeps = depsOf(
  heroAction,
  heroResponse,
  forcedResponse,
  heroInterrupt,
  plainAction,
  plainResponse,
  alterEgoAction,
  upgradeAction,
  WIPE,
);

function onVillain(state: GameState, id: string): GameState {
  const villain = state.activeVillainId;
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...state.instances[id as never]!, attachedTo: villain },
      [villain]: {
        ...state.instances[villain]!,
        attachments: [...state.instances[villain]!.attachments, id as never],
      },
    },
  };
}

function start(): GameState {
  let state = gameAtFirstTurn({
    cards: [...ENCOUNTER, FROST, WIPE_CARD],
    deps,
    encounter: ENCOUNTER.map((card) => card.id),
    deck: [FROST.id, WIPE_CARD.id],
  });
  for (const card of ENCOUNTER) {
    const placed = encounterCardInVillainArea(state, card.id, 0);
    state = onVillain(
      { ...placed.state, villainArea: placed.state.villainArea.filter((id) => id !== placed.id) },
      placed.id,
    );
  }
  // A player upgrade attached to the villain: it prints a Hero Action and is not an attachment.
  const frost = playerCardIntoPlay(state, FROST.id);
  const offArea = frost.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== frost.id) }));
  return onVillain({ ...frost.state, players: offArea }, frost.id);
}

const names = (state: GameState, ids: readonly string[]) =>
  ids.map((id) => state.cardPool[state.instances[id as never]!.cardId]!.name).sort();
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const HERO_ACTION_OR_RESPONSE: TargetQuery = {
  categories: ["attachment"],
  printsAbility: { kinds: ["action", "response"], form: "hero" },
};
const found = (state: GameState, query: TargetQuery) => names(state, selectTargets(state, query, context));

describe("§3.77 `TargetQuery.printsAbility`", () => {
  it("matches the attachments printing Hero Action or Hero Response, and no other label", () => {
    // Out: Forced Response, Hero Interrupt, Action and Response with no form, Alter-Ego Action, no player ability.
    expect(found(start(), HERO_ACTION_OR_RESPONSE)).toEqual(["gear", "net"]);
  });

  it("each kind is read on its own, and the form is part of the label", () => {
    const state = start();
    expect(found(state, { categories: ["attachment"], printsAbility: { kinds: ["action"], form: "hero" } })).toEqual([
      "gear",
    ]);
    expect(found(state, { categories: ["attachment"], printsAbility: { kinds: ["response"], form: "hero" } })).toEqual([
      "net",
    ]);
    expect(
      found(state, { categories: ["attachment"], printsAbility: { kinds: ["action", "response"], form: "alterEgo" } }),
    ).toEqual(["cuffs"]);
  });

  it("a player upgrade on an enemy prints the label but is not an attachment; without the category it matches", () => {
    const state = start();
    expect(found(state, HERO_ACTION_OR_RESPONSE)).not.toContain("frost");
    expect(found(state, { printsAbility: { kinds: ["action"], form: "hero" } })).toEqual(["frost", "gear"]);
  });

  it("a blank text box does not hide what the card prints (`abilityTiming` reads the live abilities and sees none)", () => {
    const state = playerCardIntoPlay(start(), WIPE_CARD.id).state;
    expect(found(state, HERO_ACTION_OR_RESPONSE)).toEqual(["gear", "net"]);
    expect(found(state, { categories: ["attachment"], abilityTiming: ["heroAction", "heroResponse"] })).toEqual([
      "gear",
    ]);
  });

  it("the card is read wherever it is: a copy still in the encounter deck matches", () => {
    const state = gameAtFirstTurn({ cards: ENCOUNTER, deps, encounter: [NET.id, DRAIN.id] });
    const inDeck = (name: string) =>
      Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;
    expect(explainQuery(state, inDeck("net"), HERO_ACTION_OR_RESPONSE, context)).toBeNull();
    expect(explainQuery(state, inDeck("drain"), HERO_ACTION_OR_RESPONSE, context)).toBe("noSuchAbility");
  });

  it("the exclusion is `noSuchAbility`, and a ref with no script in the registry has no label to read", () => {
    const state = start();
    const idOf = (name: string) =>
      Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;
    for (const name of ["spikes", "stakes", "wrap", "restraint", "cuffs", "drain", "ghost"])
      expect(explainQuery(state, idOf(name), HERO_ACTION_OR_RESPONSE, context)).toBe("noSuchAbility");
    expect(explainQuery(state, idOf("frost"), HERO_ACTION_OR_RESPONSE, context)).toBe("wrongCategory");
  });
});
