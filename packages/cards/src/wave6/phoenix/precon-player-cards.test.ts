import { cardId } from "@mc/content";
import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import type { AbilityDefinition } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  firstLegal,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  play,
  runWith,
  settle,
  threatOn,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE6_DEPS } from "../index.js";
import { phoenixGame } from "./phoenix/support.js";
import { PHOENIX_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/** Passion for Justice 34020 (`phoenix/precon-player-cards.ts`), played from Phoenix's own precon. */
const accepting: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return firstLegal(state);
};

const iconsOf = (state: GameState, id: InstanceId): number =>
  Object.values(
    (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons ?? {},
  ).reduce((a, b) => a + b, 0);

/** Plays event `code` (cost `cost`) in hero form, paying with Passion for Justice first when `spendIt`. */
function playEvent(code: string, cost: number, spendIt: boolean) {
  const base = withForm(phoenixGame("rhino", { seed: 3 }), { heroForm: 0 });
  const owner = playerOf(base, P1);
  const stocked: GameState = {
    ...base,
    players: base.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...owner.deck.slice(0, 8)], deck: p.deck.slice(8) } : p,
    ),
  };
  const given = moveToHand(stocked, P1, code, "34020");
  const [event, passion] = given.ids as [InstanceId, InstanceId];
  const fillers = playerOf(given.state, P1)
    .hand.filter((id) => id !== event && id !== passion && iconsOf(given.state, id) === 1)
    .slice(0, cost);
  const payment = spendIt ? [passion, ...fillers.slice(0, cost - iconsOf(given.state, passion))] : fillers;
  const bumped = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 8 });
  const before = mainThreat(bumped);
  const after = settle(runWith(WAVE6_DEPS, bumped, play(P1, event, payment)), accepting, undefined, WAVE6_DEPS);
  return { before, after, passion };
}
const villainOf = (state: GameState) => activeVillain(state).instanceId;

/**
 * Mutant Peacekeepers 34018 ("remove X threat from among schemes in play") played in hero form with Marvel Girl 34015
 * exhausted beside Phoenix (THW 3 + 2), 10 threat on the main scheme and on a side scheme, X split 3 / 2 between them;
 * paid with Passion for Justice when `spendIt`, with another card otherwise.
 */
function playPeacekeepers(spendIt: boolean) {
  const base = withForm(phoenixGame("rhino", { seed: 3 }), { heroForm: 0 });
  // Phoenix Force Restrained, as her events' tests stage it: her printed THW.
  const force = Object.keys(base.instances).find((id) => base.instances[id as InstanceId]!.cardId === cardId("34002a"));
  const restrained = patchInstance(base, force as InstanceId, { flipped: false, counters: { power: 2 } });
  const given = moveToHand(restrained, P1, "34018", "34020", "34015");
  const [event, passion, ally] = given.ids as [InstanceId, InstanceId, InstanceId];
  // Marvel Girl straight into play (surgery: no cost, no enter-play).
  const allied: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== ally), playArea: [...p.playArea, ally] } : p,
    ),
    instances: {
      ...given.state.instances,
      [ally]: { ...given.state.instances[ally]!, faceup: true, controllerId: P1 },
    },
  };
  const main = allied.mainScheme.instanceId;
  const { state: staged, id: side } = encounterCardInVillainArea(
    patchInstance(allied, main, { threat: 10 }),
    "01107",
    10,
  );
  const filler = playerOf(staged, P1).hand.find((id) => id !== event && id !== passion && iconsOf(staged, id) === 1)!;
  const dividing: Picker = (state) =>
    state.pendingChoice?.prompt.kind === "divide"
      ? [`${main}#1`, `${main}#2`, `${main}#3`, `${side}#1`, `${side}#2`]
      : accepting(state);
  const after = settle(
    runWith(WAVE6_DEPS, staged, play(P1, event, [spendIt ? passion : filler])),
    dividing,
    undefined,
    WAVE6_DEPS,
  );
  return { removed: [10 - threatOn(after, main), 10 - threatOn(after, side)] };
}

describe("Passion for Justice (34020)", () => {
  it("is a valid ability definition", () => {
    const definition = (PHOENIX_PRECON_PLAYER_CARDS as Record<string, AbilityDefinition>)[
      "34020.passion-for-justice-interrupt"
    ];
    expect(validateDefinition(definition!)).toEqual([]);
  });

  it("spent to play a THWART event, that event removes 1 additional threat (Telepathic Trickery: 4 + 1)", () => {
    const { before, after, passion } = playEvent("34012", 2, true);
    expect(before - mainThreat(after)).toBe(5);
    expect(playerOf(after, P1).discard).toContain(passion);
  });

  it("the same event paid with other cards removes only its own 4", () => {
    const { before, after } = playEvent("34012", 2, false);
    expect(before - mainThreat(after)).toBe(4);
  });

  // FAQ "Shrink (#11)" (RRG 1.8 p. 59) and "Event" (p. 19): each instance of threat the event removes is increased,
  // and each scheme's share of a division is an instance (RRG 1.8 "Thwart", p. 44).
  it("spent to play a THWART event that divides its threat, each scheme given a share loses 1 additional threat (Mutant Peacekeepers: 3 / 2 becomes 4 / 3)", () => {
    expect(playPeacekeepers(true).removed).toEqual([4, 3]);
  });

  it("the same division paid with another card removes only the shares (3 / 2)", () => {
    expect(playPeacekeepers(false).removed).toEqual([3, 2]);
  });

  it("spent to play a non-THWART event it adds nothing (Psychic Blast: 4 damage, no threat removed)", () => {
    const { before, after } = playEvent("34011", 2, true);
    expect(mainThreat(after)).toBe(before);
    expect(inst(after, villainOf(after)).damage).toBe(4);
  });
});
