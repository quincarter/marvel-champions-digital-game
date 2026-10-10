import { BP_CARDS, cardId, type EventCard, type ResourceCard } from "@mc/content";
import { applyCommand, type GameState, type InstanceId } from "@mc/engine";
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
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { BP_DEPS, bpGame, bpHeroGame } from "../testing.js";
import { BLACK_PANTHER_EVENTS, BLACK_PANTHER_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Panther's events (51003 to 51006), docs/phase7-wave9.md section 3.36. The pack's own Black Panther upgrades
 * (51010 to 51013) are another module's work and are not scripted yet, so the Specials here belong to two Core Black
 * Panther upgrades swapped into the `bp-justice` precon in place of aspect cards (the same stand-ins as the identity
 * test): Tactical Genius 01048 (thwart 1, 2 as the final step), Panther Claws 01047 (attack 2, 4 as the final step),
 * Vibranium Suit 01049 (attack: move 1 damage from the hero, 2 as the final step) and Energy Daggers 01046.
 */
const STRIKE = "51003.clawed-strike-action";
const PROWL = "51004.on-the-prowl-action";
const FOREVER = "51005.wakanda-forever-action";
const GENIUS = "01048";
const CLAWS = "01047";
const SWAP = { "51015": GENIUS, "51019": CLAWS } as const;
const SCHEME_THREAT = 5;

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const damage = (s: GameState): number => inst(s, villainOf(s)).damage;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

/** Hero form, a main scheme at 5 threat, and these upgrades (by code) put into play at their printed cost 2. */
function withUpgrades(...codes: readonly string[]): GameState {
  const hero = bpHeroGame({ swap: SWAP });
  let state = patchInstance(hero, schemeOf(hero), { threat: SCHEME_THREAT });
  for (const code of codes) {
    const given = moveToHand(state, P1, code);
    const upgrade = given.ids[0]!;
    state = settle(
      runWith(BP_DEPS, given.state, play(P1, upgrade, payWith(given.state, P1, 2, [upgrade]))),
      firstLegal,
      undefined,
      BP_DEPS,
    );
    expect(inst(state, upgrade).attachedTo, `${code} attached`).toBe(identityOf(state));
  }
  return state;
}

/** Plays the event `code` (cost paid with `cost` other hand cards), answering every prompt with `pick`. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  return driveEventsPicking(BP_DEPS, given.state, pick, play(P1, event, payWith(given.state, P1, cost, [event])));
}

/** Answers a "which upgrade" prompt with the upgrade of `special`, the villain/scheme with the only choice, otherwise first. */
const choosing =
  (special?: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTarget" && special) {
      const wanted = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === special);
      if (wanted) return [wanted.optionId];
    }
    return firstLegal(s);
  };

describe("Black Panther events registry", () => {
  it("51003, 51004 and 51005 validate and are Hero Actions; nothing else is registered or skipped", () => {
    expect(Object.keys(BLACK_PANTHER_EVENTS).sort()).toEqual([STRIKE, PROWL, FOREVER]);
    for (const ref of [STRIKE, PROWL, FOREVER]) {
      expect(validateDefinition(BLACK_PANTHER_EVENTS[ref]!), ref).toEqual([]);
      expect(BLACK_PANTHER_EVENTS[ref]!.trigger, ref).toMatchObject({ kind: "action", form: "hero" });
    }
    expect(BLACK_PANTHER_EVENTS_SKIPPED).toEqual({});
  });
  it("the printed card data names exactly these refs, and Vibranium prints no ability", () => {
    for (const [code, ref] of [
      ["51003", STRIKE],
      ["51004", PROWL],
      ["51005", FOREVER],
      ["51006", undefined],
    ] as const) {
      const card = BP_CARDS.find((c) => c.id === cardId(code)) as EventCard;
      expect(
        card.abilities.map((a) => a.id as string),
        code,
      ).toEqual(ref ? [ref] : []);
    }
  });
});

describe(`${STRIKE} (Clawed Strike 51003): deal 4 damage to an enemy, then resolve 1 Black Panther upgrade's Special`, () => {
  it("costs 2 and is an attack event", () => {
    const card = BP_CARDS.find((c) => c.id === cardId("51003")) as EventCard;
    expect(card.cost).toBe(2);
    expect(card.traits.map(String)).toContain("ATTACK");
  });
  it("with no Black Panther upgrade it deals 4 to Rhino and asks nothing further", () => {
    const { state } = playEvent(withUpgrades(), "51003", 2);
    expect(damage(state)).toBe(4);
    expect(state.pendingChoice).toBeNull();
    expect(playerOf(state, P1).discard.map((id) => codeOf(state, id))).toContain("51003");
  });
  it("with Panther Claws: 4 damage, then the Special as the final step deals 4 more: 8 on Rhino", () => {
    const { state } = playEvent(withUpgrades(CLAWS), "51003", 2);
    expect(damage(state)).toBe(8);
    expect(threat(state)).toBe(SCHEME_THREAT);
  });
  it("with Tactical Genius: 4 damage, then the Special removes 2 threat (final step): 5 to 3", () => {
    const { state } = playEvent(withUpgrades(GENIUS), "51003", 2);
    expect(damage(state)).toBe(4);
    expect(threat(state)).toBe(SCHEME_THREAT - 2);
  });
  it("with two upgrades the player chooses one Special and only it resolves", () => {
    const s = withUpgrades(CLAWS, GENIUS);
    const claws = playEvent(s, "51003", 2, choosing(CLAWS)).state;
    expect([damage(claws), threat(claws)]).toEqual([8, SCHEME_THREAT]);
    const genius = playEvent(s, "51003", 2, choosing(GENIUS)).state;
    expect([damage(genius), threat(genius)]).toEqual([4, SCHEME_THREAT - 2]);
  });
  it("it is a hero action: refused in alter-ego form", () => {
    const s = bpGame({ swap: SWAP });
    const given = moveToHand(s, P1, "51003");
    const result = applyCommand(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, given.ids)), BP_DEPS);
    expect(result.ok).toBe(false);
  });
});

describe(`${PROWL} (On the Prowl 51004): remove 3 threat from a scheme, then resolve 1 Black Panther upgrade's Special`, () => {
  it("costs 2 and is a thwart event", () => {
    const card = BP_CARDS.find((c) => c.id === cardId("51004")) as EventCard;
    expect(card.cost).toBe(2);
    expect(card.traits.map(String)).toContain("THWART");
  });
  it("with no Black Panther upgrade it removes 3 from the main scheme: 5 to 2", () => {
    const { state } = playEvent(withUpgrades(), "51004", 2);
    expect(threat(state)).toBe(2);
    expect(state.pendingChoice).toBeNull();
  });
  it("with Tactical Genius: 3 removed, then the Special's 2 as the final step: 5 to 2 to 0", () => {
    const { state } = playEvent(withUpgrades(GENIUS), "51004", 2);
    expect(threat(state)).toBe(0);
  });
  it("with Panther Claws: 3 threat removed, then 4 damage to Rhino", () => {
    const { state } = playEvent(withUpgrades(CLAWS), "51004", 2);
    expect(threat(state)).toBe(2);
    expect(damage(state)).toBe(4);
  });
});

describe(`${FOREVER} (Wakanda Forever! 51005): resolve the Special on each Black Panther upgrade in any order`, () => {
  it("costs 1", () => {
    expect((BP_CARDS.find((c) => c.id === cardId("51005")) as EventCard).cost).toBe(1);
  });
  it("with no Black Panther upgrade nothing happens and nothing is asked", () => {
    const { state } = playEvent(withUpgrades(), "51005", 1);
    expect([damage(state), threat(state)]).toEqual([0, SCHEME_THREAT]);
    expect(state.pendingChoice).toBeNull();
  });
  it("Genius then Claws in the chosen order: Genius 1 threat, Claws final step 4 damage", () => {
    const s = withUpgrades(GENIUS, CLAWS);
    const given = moveToHand(s, P1, "51005");
    const played = runWith(BP_DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)));
    expect(played.pendingChoice?.prompt.kind).toBe("orderSpecials");
    const order = played.pendingChoice!.options.map((o) => o.optionId);
    const byCode = (code: string) => order.find((o) => codeOf(played, o.split(":")[0] as InstanceId) === code)!;
    const { state } = driveEventsPicking(BP_DEPS, played, (st) =>
      st.pendingChoice!.prompt.kind === "orderSpecials" ? [byCode(GENIUS), byCode(CLAWS)] : firstLegal(st),
    );
    expect([damage(state), threat(state)]).toEqual([4, SCHEME_THREAT - 1]);
  });
  it("Claws then Genius in the other order: Claws 2 damage, Genius final step removes 2 threat", () => {
    const s = withUpgrades(GENIUS, CLAWS);
    const given = moveToHand(s, P1, "51005");
    const played = runWith(BP_DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)));
    const order = played.pendingChoice!.options.map((o) => o.optionId);
    const byCode = (code: string) => order.find((o) => codeOf(played, o.split(":")[0] as InstanceId) === code)!;
    const { state } = driveEventsPicking(BP_DEPS, played, (st) =>
      st.pendingChoice!.prompt.kind === "orderSpecials" ? [byCode(CLAWS), byCode(GENIUS)] : firstLegal(st),
    );
    expect([damage(state), threat(state)]).toEqual([2, SCHEME_THREAT - 2]);
  });
});

describe("Vibranium 51006: a resource card producing 2 wild", () => {
  it("is a resource with two wild icons and no text", () => {
    const card = BP_CARDS.find((c) => c.id === cardId("51006")) as ResourceCard;
    expect(card.type).toBe("resource");
    expect(card.producesIcons).toEqual({ wild: 2 });
    expect(card.text.current).toBe("");
  });
  it("alone it pays the 2 cost of Clawed Strike", () => {
    const s = withUpgrades();
    const given = moveToHand(s, P1, "51006", "51003");
    const [vibranium, strike] = given.ids as [InstanceId, InstanceId];
    const { state } = driveEventsPicking(BP_DEPS, given.state, firstLegal, play(P1, strike, [vibranium]));
    expect(damage(state)).toBe(4);
    expect(playerOf(state, P1).discard).toContain(vibranium);
  });
});
